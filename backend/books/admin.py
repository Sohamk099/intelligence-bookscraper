from django.contrib import admin

from .models import AIInsight, Book, ChatHistory


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "genre", "rating", "availability", "created_at")
    search_fields = ("title", "author", "genre")
    list_filter = ("genre", "sentiment")


@admin.register(AIInsight)
class AIInsightAdmin(admin.ModelAdmin):
    list_display = ("book", "insight_type", "model_used", "created_at")
    list_filter = ("insight_type",)
    search_fields = ("book__title", "content")


@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ("question", "created_at")
    search_fields = ("question", "answer")
