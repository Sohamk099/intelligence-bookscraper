from rest_framework import serializers

from .models import AIInsight, Book, ChatHistory


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = ("id", "insight_type", "content", "model_used", "created_at")


class BookListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = (
            "id",
            "title",
            "author",
            "rating",
            "reviews",
            "description",
            "book_url",
            "cover_image_url",
            "genre",
            "sentiment",
            "price",
            "availability",
        )


class BookDetailSerializer(serializers.ModelSerializer):
    insights = AIInsightSerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = (
            "id",
            "title",
            "author",
            "rating",
            "reviews",
            "description",
            "book_url",
            "cover_image_url",
            "genre",
            "summary",
            "sentiment",
            "sentiment_score",
            "price",
            "availability",
            "insights",
            "created_at",
            "updated_at",
        )


class ChatHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatHistory
        fields = ("id", "question", "answer", "sources", "context_used", "created_at")


class ScrapeRequestSerializer(serializers.Serializer):
    url = serializers.URLField(default="https://books.toscrape.com")
    max_pages = serializers.IntegerField(min_value=1, max_value=20, default=3)
    generate_insights = serializers.BooleanField(default=True)


class QuestionSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000)
    top_k = serializers.IntegerField(min_value=1, max_value=10, default=5)
