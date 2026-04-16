import logging

from django.core.cache import cache
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, ChatHistory
from .serializers import (
    BookDetailSerializer,
    BookListSerializer,
    ChatHistorySerializer,
    QuestionSerializer,
    ScrapeRequestSerializer,
)
from rag.pipeline import RAGPipeline
from scraper.scraper import BookScraper


logger = logging.getLogger(__name__)


class BookListView(generics.ListAPIView):
    serializer_class = BookListSerializer

    def get_queryset(self):
        queryset = Book.objects.all().order_by("title")
        search = self.request.query_params.get("search", "").strip()
        genre = self.request.query_params.get("genre", "").strip()

        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(author__icontains=search))
        if genre:
            queryset = queryset.filter(genre__icontains=genre)
        return queryset


class BookDetailView(generics.RetrieveAPIView):
    queryset = Book.objects.prefetch_related("insights").all()
    serializer_class = BookDetailSerializer


class RecommendationsView(APIView):
    def get(self, _request, pk):
        cache_key = f"recommendations_{pk}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            book = Book.objects.get(pk=pk)
        except Book.DoesNotExist:
            return Response({"error": "Book not found."}, status=status.HTTP_404_NOT_FOUND)

        related_qs = Book.objects.none()
        if book.genre:
            related_qs = Book.objects.filter(genre__icontains=book.genre).exclude(pk=pk).order_by("-rating", "title")[:5]

        if related_qs.count() < 3:
            similar_ids = RAGPipeline().find_similar_books(book, top_k=5)
            if similar_ids:
                order = {book_id: index for index, book_id in enumerate(similar_ids)}
                related = list(Book.objects.filter(pk__in=similar_ids).exclude(pk=pk))
                related.sort(key=lambda item: order.get(item.pk, 999))
                data = BookListSerializer(related, many=True).data
                cache.set(cache_key, data, 1800)
                return Response(data)

        data = BookListSerializer(related_qs, many=True).data
        cache.set(cache_key, data, 1800)
        return Response(data)


class ScrapeView(APIView):
    def post(self, request):
        serializer = ScrapeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data

        try:
            books_data = BookScraper().scrape(url=params["url"], max_pages=params["max_pages"])
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

            processed = 0
            if params["generate_insights"] and created_books:
                processed = RAGPipeline().process_books(created_books).get("processed", 0)

            return Response(
                {
                    "message": "Scraping complete.",
                    "books_created": len(created_books),
                    "books_updated": updated_count,
                    "ai_insights_generated": processed,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            logger.exception("Scraping failed: %s", exc)
            return Response({"error": f"Scraping failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AskView(APIView):
    def post(self, request):
        serializer = QuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        top_k = serializer.validated_data["top_k"]
        cache_key = f"rag_answer_{hash((question, top_k))}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            result = RAGPipeline().answer_question(question=question, top_k=top_k)
            ChatHistory.objects.create(
                question=question,
                answer=result["answer"],
                sources=result["sources"],
                context_used=result.get("context", ""),
            )
            cache.set(cache_key, result, 600)
            return Response(result)
        except Exception as exc:
            logger.exception("RAG pipeline failed: %s", exc)
            return Response({"error": f"Could not generate answer: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatHistoryView(generics.ListAPIView):
    serializer_class = ChatHistorySerializer

    def get_queryset(self):
        return ChatHistory.objects.all()[:50]
