from django.urls import path

from .views import AskView, BookDetailView, BookListView, ChatHistoryView, RecommendationsView, ScrapeView


urlpatterns = [
    path("books/", BookListView.as_view(), name="book-list"),
    path("books/<int:pk>/", BookDetailView.as_view(), name="book-detail"),
    path("books/<int:pk>/recommendations/", RecommendationsView.as_view(), name="book-recommendations"),
    path("books/scrape/", ScrapeView.as_view(), name="book-scrape"),
    path("books/ask/", AskView.as_view(), name="book-ask"),
    path("chat/history/", ChatHistoryView.as_view(), name="chat-history"),
]
