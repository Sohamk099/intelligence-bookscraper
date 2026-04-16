import json
import logging
import re
from collections import Counter

import requests
from django.conf import settings

from books.models import AIInsight, Book


logger = logging.getLogger(__name__)

CHUNK_SIZE = 300
CHUNK_OVERLAP = 60


def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        chunk = text[start:start + chunk_size].strip()
        if len(chunk) > 20:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def build_book_document(book):
    parts = [
        f"Title: {book.title}",
        f"Author: {book.author}",
        f"Genre: {book.genre}" if book.genre else "",
        f"Description: {book.description}" if book.description else "",
        f"Summary: {book.summary}" if book.summary else "",
        f"Availability: {book.availability}" if book.availability else "",
    ]
    return "\n".join(part for part in parts if part)


class RAGPipeline:
    COLLECTION_NAME = "books"

    def __init__(self):
        self._chroma = None
        self._collection = None
        self._embedder = None
        self._llm_enabled = None

    @property
    def embedder(self):
        if self._embedder is not None:
            return self._embedder
        try:
            from sentence_transformers import SentenceTransformer

            self._embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
        except Exception as exc:
            logger.warning("Sentence transformer unavailable, using keyword fallback: %s", exc)
            self._embedder = False
        return self._embedder

    @property
    def collection(self):
        if self._collection is not None:
            return self._collection
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIR,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._chroma = client
            self._collection = client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as exc:
            logger.warning("Chroma unavailable, using database fallback: %s", exc)
            self._collection = False
        return self._collection

    @property
    def llm_enabled(self):
        if self._llm_enabled is not None:
            return self._llm_enabled
        self._llm_enabled = bool(settings.NVIDIA_API_KEY)
        return self._llm_enabled

    def process_books(self, books):
        processed = 0
        for book in books:
            try:
                self._generate_insights(book)
                self._index_book(book)
                processed += 1
            except Exception as exc:
                logger.error("Failed to process book %s: %s", book.title, exc)
        return {"processed": processed, "total": len(books)}

    def answer_question(self, question, top_k=5):
        if self.collection and self.embedder:
            try:
                return self._answer_with_vectors(question, top_k)
            except Exception as exc:
                logger.warning("Vector retrieval failed, falling back to database search: %s", exc)
        return self._answer_with_database(question, top_k)

    def find_similar_books(self, book, top_k=5):
        if self.collection and self.embedder:
            try:
                embedding = self.embedder.encode(build_book_document(book)).tolist()
                results = self.collection.query(
                    query_embeddings=[embedding],
                    n_results=top_k + 1,
                    include=["metadatas"],
                )
                book_ids = []
                for metadata in results.get("metadatas", [[]])[0]:
                    book_id = metadata.get("book_id")
                    if book_id and str(book_id) != str(book.pk):
                        book_ids.append(int(book_id))
                return book_ids[:top_k]
            except Exception as exc:
                logger.warning("Vector similarity failed, using fallback recommendations: %s", exc)

        queryset = Book.objects.exclude(pk=book.pk)
        if book.genre:
            queryset = queryset.filter(genre__icontains=book.genre)
        return list(queryset.order_by("-rating", "title").values_list("pk", flat=True)[:top_k])

    def _answer_with_vectors(self, question, top_k):
        embedding = self.embedder.encode(question).tolist()
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        if not documents:
            return self._answer_with_database(question, top_k)

        context_parts = []
        sources = []
        seen = set()
        for document, metadata, distance in zip(documents, metadatas, distances):
            title = metadata.get("title", "Unknown")
            book_id = metadata.get("book_id")
            relevance = round(1 - distance, 3)
            context_parts.append(f"[{title}] {document}")
            if title not in seen:
                sources.append({"title": title, "book_id": book_id, "relevance": relevance})
                seen.add(title)

        context = "\n\n".join(context_parts)
        answer = self._generate_answer(question, context, sources)
        return {"question": question, "answer": answer, "sources": sources, "context": context}

    def _answer_with_database(self, question, top_k):
        tokens = [token for token in re.findall(r"[a-zA-Z0-9']+", question.lower()) if len(token) > 2]
        scored = []
        for book in Book.objects.all():
            haystack = " ".join(
                [
                    book.title.lower(),
                    book.author.lower(),
                    book.genre.lower(),
                    book.description.lower(),
                    book.summary.lower(),
                ]
            )
            score = sum(1 for token in tokens if token in haystack)
            if score > 0:
                scored.append((score, book))

        scored.sort(key=lambda item: (-item[0], -(item[1].rating or 0), item[1].title))
        selected = [book for _, book in scored[:top_k]]

        if not selected:
            return {
                "question": question,
                "answer": "I could not find enough matching information in the current library. Try scraping books first or ask a more specific question.",
                "sources": [],
                "context": "",
            }

        sources = []
        context_parts = []
        for index, book in enumerate(selected):
            context_parts.append(build_book_document(book))
            sources.append(
                {
                    "title": book.title,
                    "book_id": book.pk,
                    "relevance": round(min(0.99, 0.62 + index * 0.07), 2),
                }
            )

        context = "\n\n".join(context_parts)
        answer = self._generate_answer(question, context, sources)
        return {"question": question, "answer": answer, "sources": sources, "context": context}

    def _generate_insights(self, book):
        if not book.description:
            return

        if not AIInsight.objects.filter(book=book, insight_type="summary").exists():
            summary = self._summarize_book(book)
            AIInsight.objects.create(book=book, insight_type="summary", content=summary, model_used=self._model_name())
            book.summary = summary
            book.save(update_fields=["summary"])

        if not AIInsight.objects.filter(book=book, insight_type="genre").exists():
            genre = self._infer_genre(book)
            AIInsight.objects.create(book=book, insight_type="genre", content=genre, model_used=self._model_name())
            if not book.genre:
                book.genre = genre
                book.save(update_fields=["genre"])

        if not AIInsight.objects.filter(book=book, insight_type="sentiment").exists():
            sentiment_data = self._infer_sentiment(book)
            AIInsight.objects.create(
                book=book,
                insight_type="sentiment",
                content=json.dumps(sentiment_data),
                model_used=self._model_name(),
            )
            book.sentiment = sentiment_data["label"]
            book.sentiment_score = sentiment_data["score"]
            book.save(update_fields=["sentiment", "sentiment_score"])

    def _index_book(self, book):
        if not self.collection or not self.embedder:
            return

        chunks = chunk_text(build_book_document(book))
        if not chunks:
            return

        embeddings = self.embedder.encode(chunks).tolist()
        ids = [f"book_{book.pk}_chunk_{index}" for index, _ in enumerate(chunks)]
        metadatas = [{"title": book.title, "book_id": str(book.pk), "chunk_index": index} for index, _ in enumerate(chunks)]
        self.collection.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
        if not book.chroma_doc_id:
            book.chroma_doc_id = ids[0]
            book.save(update_fields=["chroma_doc_id"])

    def _generate_answer(self, question, context, sources):
        if self.llm_enabled:
            return self._call_claude(
                system=(
                    "You are a helpful book assistant. Answer using only the provided context. "
                    "Mention book titles directly when you reference them."
                ),
                prompt=f"Context:\n{context}\n\nQuestion: {question}",
                max_tokens=500,
            )

        titles = ", ".join(source["title"] for source in sources[:3])
        return (
            f"Based on the current library, the strongest matches for '{question}' are {titles}. "
            "This answer was generated from the stored descriptions and summaries because no Anthropic API key is configured."
        )

    def _summarize_book(self, book):
        if self.llm_enabled:
            return self._call_claude(
                system="You are a literary assistant. Summarize books in 2 concise sentences.",
                prompt=f"Title: {book.title}\nDescription: {book.description}",
                max_tokens=180,
            )
        sentences = re.split(r"(?<=[.!?])\s+", book.description.strip())
        summary = " ".join(sentences[:2]).strip()
        return summary or f"{book.title} is part of the library collection."

    def _infer_genre(self, book):
        if book.genre:
            return book.genre
        if self.llm_enabled:
            return self._call_claude(
                system="Classify the book into a short genre label of one to three words.",
                prompt=f"Title: {book.title}\nDescription: {book.description}",
                max_tokens=20,
            ).strip().strip(".")

        text = f"{book.title} {book.description}".lower()
        keyword_map = {
            "Mystery": ["murder", "detective", "mystery", "crime", "investigation"],
            "Fantasy": ["dragon", "magic", "kingdom", "sword", "fantasy"],
            "Romance": ["love", "romance", "marriage", "heart"],
            "Science Fiction": ["space", "future", "robot", "science", "planet"],
            "Horror": ["ghost", "blood", "haunted", "monster", "horror"],
            "Historical Fiction": ["victorian", "war", "historical", "empire"],
        }
        for genre, keywords in keyword_map.items():
            if any(keyword in text for keyword in keywords):
                return genre
        return "General Fiction"

    def _infer_sentiment(self, book):
        if self.llm_enabled:
            raw = self._call_claude(
                system='Return only JSON like {"label":"positive","score":0.82}.',
                prompt=f"Analyze the sentiment of this description:\n{book.description}",
                max_tokens=80,
            )
            try:
                parsed = json.loads(raw)
                return {"label": parsed.get("label", "neutral"), "score": float(parsed.get("score", 0.5))}
            except Exception:
                pass

        positive_words = {"excellent", "beautiful", "delightful", "heartwarming", "inspiring", "brilliant"}
        negative_words = {"dark", "grim", "tragic", "violent", "disturbing", "bleak"}
        tokens = re.findall(r"[a-zA-Z']+", book.description.lower())
        counts = Counter(tokens)
        pos = sum(counts[word] for word in positive_words)
        neg = sum(counts[word] for word in negative_words)

        if pos > neg:
            return {"label": "positive", "score": 0.72}
        if neg > pos:
            return {"label": "negative", "score": 0.68}
        return {"label": "neutral", "score": 0.5}

    def _model_name(self):
        return settings.NVIDIA_MODEL if self.llm_enabled else "local-fallback"

    def _call_claude(self, system, prompt, max_tokens=500):
        response = requests.post(
            settings.NVIDIA_API_BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.NVIDIA_MODEL,
                "max_tokens": max_tokens,
                "temperature": 0.2,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"].strip()
