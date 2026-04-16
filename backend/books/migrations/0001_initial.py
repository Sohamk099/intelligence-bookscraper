from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Book",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=500)),
                ("author", models.CharField(blank=True, default="Unknown", max_length=300)),
                ("rating", models.FloatField(blank=True, null=True)),
                ("reviews", models.IntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True, default="")),
                ("book_url", models.URLField(max_length=1000, unique=True)),
                ("cover_image_url", models.URLField(blank=True, default="", max_length=1000)),
                ("price", models.CharField(blank=True, default="", max_length=50)),
                ("availability", models.CharField(blank=True, default="", max_length=100)),
                ("genre", models.CharField(blank=True, default="", max_length=150)),
                ("summary", models.TextField(blank=True, default="")),
                ("sentiment", models.CharField(blank=True, default="", max_length=50)),
                ("sentiment_score", models.FloatField(blank=True, null=True)),
                ("chroma_doc_id", models.CharField(blank=True, default="", max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["title"]},
        ),
        migrations.CreateModel(
            name="ChatHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question", models.TextField()),
                ("answer", models.TextField()),
                ("sources", models.JSONField(default=list)),
                ("context_used", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AIInsight",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "insight_type",
                    models.CharField(
                        choices=[
                            ("summary", "Summary"),
                            ("genre", "Genre Classification"),
                            ("sentiment", "Sentiment Analysis"),
                            ("recommendation", "Recommendation"),
                        ],
                        max_length=50,
                    ),
                ),
                ("content", models.TextField()),
                ("model_used", models.CharField(default="local-fallback", max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("book", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="insights", to="books.book")),
            ],
            options={"unique_together": {("book", "insight_type")}},
        ),
        migrations.AddIndex(model_name="book", index=models.Index(fields=["title"], name="books_book_title_57ebb1_idx")),
        migrations.AddIndex(model_name="book", index=models.Index(fields=["genre"], name="books_book_genre_7f6f3a_idx")),
    ]
