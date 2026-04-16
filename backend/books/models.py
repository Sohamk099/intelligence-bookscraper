from django.db import models


class Book(models.Model):
    title = models.CharField(max_length=500)
    author = models.CharField(max_length=300, blank=True, default="Unknown")
    rating = models.FloatField(null=True, blank=True)
    reviews = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    book_url = models.URLField(max_length=1000, unique=True)
    cover_image_url = models.URLField(max_length=1000, blank=True, default="")
    price = models.CharField(max_length=50, blank=True, default="")
    availability = models.CharField(max_length=100, blank=True, default="")
    genre = models.CharField(max_length=150, blank=True, default="")
    summary = models.TextField(blank=True, default="")
    sentiment = models.CharField(max_length=50, blank=True, default="")
    sentiment_score = models.FloatField(null=True, blank=True)
    chroma_doc_id = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["title"]), models.Index(fields=["genre"])]

    def __str__(self):
        return f"{self.title} - {self.author}"


class AIInsight(models.Model):
    INSIGHT_TYPES = [
        ("summary", "Summary"),
        ("genre", "Genre Classification"),
        ("sentiment", "Sentiment Analysis"),
        ("recommendation", "Recommendation"),
    ]

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="insights")
    insight_type = models.CharField(max_length=50, choices=INSIGHT_TYPES)
    content = models.TextField()
    model_used = models.CharField(max_length=100, default="local-fallback")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("book", "insight_type")

    def __str__(self):
        return f"{self.insight_type} -> {self.book.title}"


class ChatHistory(models.Model):
    question = models.TextField()
    answer = models.TextField()
    sources = models.JSONField(default=list)
    context_used = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Q: {self.question[:60]}..."
