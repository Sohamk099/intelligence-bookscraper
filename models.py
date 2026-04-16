"""
Database models for the Intelligence Platform.

Tables:
  - Book        : metadata for each scraped / uploaded book
  - AIInsight   : cached AI-generated insights per book
  - ChatHistory : persisted Q&A log
"""

from django.db import models


class Book(models.Model):
    """Core book metadata scraped from the web."""

    title = models.CharField(max_length=500)
    author = models.CharField(max_length=300, blank=True, default="Unknown")
    rating = models.FloatField(null=True, blank=True)
    reviews = models.IntegerField(null=True, blank=True)          # number of reviews
    description = models.TextField(blank=True, default="")
    book_url = models.URLField(max_length=1000)
    cover_image_url = models.URLField(max_length=1000, blank=True, default="")
    price = models.CharField(max_length=50, blank=True, default="")
    availability = models.CharField(max_length=100, blank=True, default="")

    # AI-generated fields (populated asynchronously)
    genre = models.CharField(max_length=150, blank=True, default="")
    summary = models.TextField(blank=True, default="")
    sentiment = models.CharField(max_length=50, blank=True, default="")  # positive/neutral/negative
    sentiment_score = models.FloatField(null=True, blank=True)

    # ChromaDB document ID for vector lookup
    chroma_doc_id = models.CharField(max_length=200, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["title"]),
            models.Index(fields=["genre"]),
        ]

    def __str__(self):
        return f"{self.title} — {self.author}"


class AIInsight(models.Model):
    """
    Cached AI insight for a book.
    Prevents repeated API calls for the same book.
    """

    INSIGHT_TYPES = [
        ("summary", "Summary"),
        ("genre", "Genre Classification"),
        ("sentiment", "Sentiment Analysis"),
        ("recommendation", "Recommendation"),
    ]

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="insights")
    insight_type = models.CharField(max_length=50, choices=INSIGHT_TYPES)
    content = models.TextField()
    model_used = models.CharField(max_length=100, default="claude-sonnet-4-20250514")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("book", "insight_type")  # one insight per type per book

    def __str__(self):
        return f"{self.insight_type} → {self.book.title}"


class ChatHistory(models.Model):
    """Persisted Q&A sessions from the RAG interface."""

    question = models.TextField()
    answer = models.TextField()
    # JSON list of {"title": ..., "book_id": ..., "relevance": ...}
    sources = models.JSONField(default=list)
    context_used = models.TextField(blank=True, default="")   # for debugging
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Q: {self.question[:60]}..."
