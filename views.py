"""
API views for the Intelligence Platform.

Endpoints
─────────
GET  /api/books/                  → BookListView       : paginated book list
GET  /api/books/<id>/             → BookDetailView     : single book + insights
GET  /api/books/<id>/recommendations/ → RecommendationsView
POST /api/books/scrape/           → ScrapeView         : trigger scraper
POST /api/books/ask/              → AskView            : RAG Q&A
GET  /api/chat/history/           → ChatHistoryView    : past Q&A
"""

import logging
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Book, ChatHistory
from .serializers import (
    BookListSerializer,
    BookDetailSerializer,
    ChatHistorySerializer,
    ScrapeRequestSerializer,
    QuestionSerializer,
)
from scraper.scraper import BookScraper
from rag.pipeline import RAGPipeline

logger = logging.getLogger(__name__)


# ─── GET endpoints ────────────────────────────────────────────────────────────


class BookListView(generics.ListAPIView):
    """
    GET /api/books/
    Returns all books, newest first. Supports ?search=<term>&genre=<genre>.
    Response is cached for 5 minutes.
    """

    serializer_class = BookListSerializer

    def get_queryset(self):
        qs = Book.objects.all()
        search = self.request.query_params.get("search")
        genre = self.request.query_params.get("genre")
        if search:
            qs = qs.filter(title__icontains=search) | qs.filter(author__icontains=search)
        if genre:
            qs = qs.filter(genre__icontains=genre)
        return qs


class BookDetailView(generics.RetrieveAPIView):
    """
    GET /api/books/<id>/
    Returns full book data including AI insights.
    """

    queryset = Book.objects.prefetch_related("insights").all()
    serializer_class = BookDetailSerializer


class RecommendationsView(APIView):
    """
    GET /api/books/<id>/recommendations/
    Returns up to 5 books similar to the requested book.
    Uses genre match first, then falls back to vector similarity.
    Caches result per book for 30 minutes.
    """

    def get(self, request, pk):
        cache_key = f"recommendations_{pk}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            book = Book.objects.get(pk=pk)
        except Book.DoesNotExist:
            return Response({"error": "Book not found."}, status=status.HTTP_404_NOT_FOUND)

        # Primary: same genre
        related_qs = (
            Book.objects.filter(genre__icontains=book.genre)
            .exclude(pk=pk)
            .order_by("-rating")[:5]
            if book.genre
            else Book.objects.none()
        )

        # Fallback: vector similarity via RAG pipeline
        if related_qs.count() < 3 and book.description:
            try:
                pipeline = RAGPipeline()
                similar_ids = pipeline.find_similar_books(book, top_k=5)
                related_qs = Book.objects.filter(pk__in=similar_ids).exclude(pk=pk)
            except Exception as e:
                logger.warning("Vector similarity failed: %s", e)

        serializer = BookListSerializer(related_qs, many=True)
        data = serializer.data
        cache.set(cache_key, data, 1800)  # 30-minute cache
        return Response(data)


# ─── POST endpoints ───────────────────────────────────────────────────────────


class ScrapeView(APIView):
    """
    POST /api/books/scrape/
    Body: { "url": "...", "max_pages": 3, "generate_insights": true }

    Triggers the scraper, persists new books to the DB, optionally runs AI
    insight generation, and indexes all new books into ChromaDB.
    """

    def post(self, request):
        serializer = ScrapeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data

        try:
            scraper = BookScraper()
            books_data = scraper.scrape(
                url=params["url"],
                max_pages=params["max_pages"],
            )

            created_books = []
            updated_count = 0

            for book_data in books_data:
                book, created = Book.objects.update_or_create(
                    book_url=book_data["book_url"],
                    defaults=book_data,
                )
                if created:
                    created_books.append(book)
                else:
                    updated_count += 1

            # Generate AI insights and index into ChromaDB
            if params["generate_insights"] and created_books:
                pipeline = RAGPipeline()
                insight_results = pipeline.process_books(created_books)
            else:
                insight_results = {"processed": 0}

            return Response(
                {
                    "message": "Scraping complete.",
                    "books_created": len(created_books),
                    "books_updated": updated_count,
                    "ai_insights_generated": insight_results.get("processed", 0),
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.exception("Scraping failed: %s", e)
            return Response(
                {"error": f"Scraping failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AskView(APIView):
    """
    POST /api/books/ask/
    Body: { "question": "...", "top_k": 5 }

    Full RAG pipeline:
      1. Embed the question
      2. Retrieve top-k relevant chunks from ChromaDB
      3. Build prompt with retrieved context
      4. Generate answer via Claude
      5. Persist to ChatHistory
      6. Return answer + source citations
    """

    def post(self, request):
        serializer = QuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        top_k = serializer.validated_data["top_k"]

        # Cache key based on question text + top_k
        cache_key = f"rag_answer_{hash(question)}_{top_k}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            pipeline = RAGPipeline()
            result = pipeline.answer_question(question=question, top_k=top_k)

            # Persist to chat history
            ChatHistory.objects.create(
                question=question,
                answer=result["answer"],
                sources=result["sources"],
                context_used=result.get("context", ""),
            )

            cache.set(cache_key, result, 600)  # 10-minute cache
            return Response(result)

        except Exception as e:
            logger.exception("RAG pipeline failed: %s", e)
            return Response(
                {"error": f"Could not generate answer: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ChatHistoryView(generics.ListAPIView):
    """
    GET /api/chat/history/
    Returns the last 50 Q&A pairs, newest first.
    """

    queryset = ChatHistory.objects.all()[:50]
    serializer_class = ChatHistorySerializer
