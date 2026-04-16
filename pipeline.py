"""
RAG Pipeline
────────────
Implements the full Retrieval-Augmented Generation flow:

  1. Chunking    — split book text into overlapping windows
  2. Embedding   — sentence-transformers (local, no API key)
  3. Indexing    — ChromaDB vector store
  4. Retrieval   — cosine-similarity top-k search
  5. Generation  — Anthropic Claude with cited context
  6. Insights    — summary / genre / sentiment via Claude

Caching strategy:
  - AI insights are cached in the AIInsight table (DB cache)
  - RAG answers are cached in Django's cache backend (Redis / local-mem)
"""

import logging
import os
import uuid
from typing import Optional

import django
from django.conf import settings

logger = logging.getLogger(__name__)


# ─── Lazy imports (heavy; only loaded when pipeline is instantiated) ──────────

def _load_chromadb():
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    client = chromadb.PersistentClient(
        path=settings.CHROMA_PERSIST_DIR,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    return client


def _load_embedder():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.EMBEDDING_MODEL)


def _load_anthropic():
    import anthropic
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ─── Chunking utilities ───────────────────────────────────────────────────────

CHUNK_SIZE = 300       # characters per chunk
CHUNK_OVERLAP = 60     # overlap between consecutive chunks


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split text into overlapping fixed-size chunks.
    Uses a sliding window strategy to preserve context across boundaries.
    """
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if len(c) > 20]  # discard tiny trailing chunks


def build_book_document(book) -> str:
    """Combine all textual fields into one document for embedding."""
    parts = [
        f"Title: {book.title}",
        f"Author: {book.author}",
        f"Genre: {book.genre}" if book.genre else "",
        f"Description: {book.description}" if book.description else "",
        f"Summary: {book.summary}" if book.summary else "",
    ]
    return "\n".join(p for p in parts if p)


# ─── Main pipeline class ──────────────────────────────────────────────────────

class RAGPipeline:
    """Lazy-initialised RAG pipeline. Safe to instantiate anywhere."""

    COLLECTION_NAME = "books"

    def __init__(self):
        self._chroma = None
        self._collection = None
        self._embedder = None
        self._claude = None

    # ── Lazy property accessors ──────────────────────────────────────────────

    @property
    def chroma(self):
        if self._chroma is None:
            self._chroma = _load_chromadb()
        return self._chroma

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.chroma.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    @property
    def embedder(self):
        if self._embedder is None:
            self._embedder = _load_embedder()
        return self._embedder

    @property
    def claude(self):
        if self._claude is None:
            self._claude = _load_anthropic()
        return self._claude

    # ─── Public methods ───────────────────────────────────────────────────────

    def process_books(self, books: list) -> dict:
        """
        For each Book instance:
          1. Generate AI insights (summary, genre, sentiment)
          2. Index text chunks into ChromaDB

        Returns a summary dict.
        """
        processed = 0
        for book in books:
            try:
                self._generate_insights(book)
                self._index_book(book)
                processed += 1
            except Exception as e:
                logger.error("Failed to process book %s: %s", book.title, e)
        return {"processed": processed, "total": len(books)}

    def answer_question(self, question: str, top_k: int = 5) -> dict:
        """
        Full RAG Q&A:
          1. Embed the question
          2. Retrieve top-k chunks
          3. Build context
          4. Generate answer with citations
        """
        # Step 1: Embed question
        q_embedding = self.embedder.encode(question).tolist()

        # Step 2: Retrieve chunks
        results = self.collection.query(
            query_embeddings=[q_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        documents = results["documents"][0] if results["documents"] else []
        metadatas = results["metadatas"][0] if results["metadatas"] else []
        distances = results["distances"][0] if results["distances"] else []

        if not documents:
            return {
                "question": question,
                "answer": (
                    "I couldn't find relevant information in the book collection. "
                    "Try scraping more books first."
                ),
                "sources": [],
                "context": "",
            }

        # Step 3: Build context string
        context_parts = []
        sources = []
        seen_books = set()

        for doc, meta, dist in zip(documents, metadatas, distances):
            title = meta.get("title", "Unknown")
            book_id = meta.get("book_id", "")
            relevance = round(1 - dist, 3)  # cosine similarity → relevance score

            context_parts.append(f"[{title}]: {doc}")

            if title not in seen_books:
                sources.append({"title": title, "book_id": book_id, "relevance": relevance})
                seen_books.add(title)

        context = "\n\n".join(context_parts)

        # Step 4: Generate answer
        answer = self._generate_answer(question=question, context=context)

        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "context": context,
        }

    def find_similar_books(self, book, top_k: int = 5) -> list[int]:
        """Return IDs of books most similar to the given book via vector search."""
        doc_text = build_book_document(book)
        embedding = self.embedder.encode(doc_text).tolist()

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k + 1,  # +1 because the book itself will appear
            include=["metadatas"],
        )

        book_ids = []
        for meta in results["metadatas"][0]:
            bid = meta.get("book_id")
            if bid and str(bid) != str(book.pk):
                book_ids.append(int(bid))

        return book_ids[:top_k]

    # ─── Private helpers ──────────────────────────────────────────────────────

    def _generate_insights(self, book) -> None:
        """Generate and cache summary, genre, and sentiment for a book."""
        from books.models import AIInsight  # avoid circular import

        # Only generate if description exists
        if not book.description:
            return

        # ── Summary ────────────────────────────────────────────────────────
        if not AIInsight.objects.filter(book=book, insight_type="summary").exists():
            summary = self._call_claude(
                system="You are a literary assistant. Be concise and informative.",
                prompt=(
                    f"Write a 2-3 sentence summary of this book:\n\n"
                    f"Title: {book.title}\nDescription: {book.description}"
                ),
                max_tokens=200,
            )
            AIInsight.objects.create(book=book, insight_type="summary", content=summary)
            book.summary = summary
            book.save(update_fields=["summary"])

        # ── Genre classification ────────────────────────────────────────────
        if not AIInsight.objects.filter(book=book, insight_type="genre").exists():
            genre = self._call_claude(
                system="You are a genre classification expert. Reply with ONLY the genre name (1-3 words).",
                prompt=(
                    f"Classify the genre of:\nTitle: {book.title}\n"
                    f"Description: {book.description}"
                ),
                max_tokens=20,
            ).strip().strip(".")
            AIInsight.objects.create(book=book, insight_type="genre", content=genre)
            if not book.genre:  # don't overwrite scraped genre
                book.genre = genre
                book.save(update_fields=["genre"])

        # ── Sentiment analysis ──────────────────────────────────────────────
        if not AIInsight.objects.filter(book=book, insight_type="sentiment").exists():
            sentiment_raw = self._call_claude(
                system=(
                    "You are a sentiment analyser. "
                    "Respond with ONLY a JSON object like: "
                    '{\"label\": \"positive\", \"score\": 0.85, \"reason\": \"...\"}'
                ),
                prompt=(
                    f"Analyse the tone/sentiment of this book description:\n{book.description}"
                ),
                max_tokens=100,
            )
            AIInsight.objects.create(book=book, insight_type="sentiment", content=sentiment_raw)

            # Parse and persist label to Book
            try:
                import json
                s = json.loads(sentiment_raw)
                book.sentiment = s.get("label", "neutral")
                book.sentiment_score = float(s.get("score", 0.5))
                book.save(update_fields=["sentiment", "sentiment_score"])
            except Exception:
                book.sentiment = "neutral"
                book.save(update_fields=["sentiment"])

    def _index_book(self, book) -> None:
        """Chunk the book document and upsert chunks into ChromaDB."""
        doc_text = build_book_document(book)
        chunks = chunk_text(doc_text)

        if not chunks:
            return

        embeddings = self.embedder.encode(chunks).tolist()

        ids = [f"book_{book.pk}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {"title": book.title, "book_id": str(book.pk), "chunk_index": i}
            for i in range(len(chunks))
        ]

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )

        # Store first chunk ID as representative doc ID
        if not book.chroma_doc_id:
            book.chroma_doc_id = ids[0]
            book.save(update_fields=["chroma_doc_id"])

    def _generate_answer(self, question: str, context: str) -> str:
        """Call Claude to answer a question given retrieved context."""
        return self._call_claude(
            system=(
                "You are a knowledgeable book assistant. "
                "Answer questions using ONLY the provided context. "
                "Always cite book titles when referencing them. "
                "If the context doesn't contain enough information, say so honestly."
            ),
            prompt=(
                f"Context from the book collection:\n{context}\n\n"
                f"Question: {question}\n\n"
                "Provide a helpful, accurate answer with book citations."
            ),
            max_tokens=600,
        )

    def _call_claude(self, system: str, prompt: str, max_tokens: int = 500) -> str:
        """
        Thin wrapper around the Anthropic Claude API.
        Returns the text content of the first response block.
        """
        message = self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
