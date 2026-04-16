import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Lightbulb, ScanSearch, ThumbsUp } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchBookDetail, fetchRecommendations } from "../api/client.js";
import BookCard from "../components/BookCard.jsx";
import { BookCover, ErrorBanner, GenrePill, LoadingState, SentimentBadge, StarRating } from "../components/UI.jsx";


function InsightPanel({ book }) {
  const [tab, setTab] = useState("summary");

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "genre", label: "Genre" },
    { id: "sentiment", label: "Sentiment" },
  ];

  const readInsight = (type) => book.insights?.find((item) => item.insight_type === type)?.content || "";

  const content = {
    summary: readInsight("summary") || book.summary || "No summary generated yet.",
    genre: readInsight("genre") || book.genre || "Genre not classified yet.",
    sentiment: readInsight("sentiment") || "Sentiment analysis not available.",
  };

  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center gap-2 text-white">
        <Lightbulb size={16} className="text-brand-300" />
        <h3 className="font-semibold">AI insights</h3>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={tab === item.id ? "btn-primary" : "btn-ghost"}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{content[tab]}</p>
    </div>
  );
}

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [bookData, relatedData] = await Promise.all([
          fetchBookDetail(id),
          fetchRecommendations(id).catch(() => []),
        ]);
        setBook(bookData);
        setRelated(Array.isArray(relatedData) ? relatedData : relatedData.results ?? []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) return <LoadingState message="Loading book details..." />;
  if (error) return <ErrorBanner message={error} />;
  if (!book) return null;

  return (
    <div className="space-y-8">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
        <ArrowLeft size={15} />
        Back to library
      </button>

      <section className="card relative overflow-hidden p-6">
        <div className="absolute right-10 top-10 h-32 w-32 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
          <BookCover src={book.cover_image_url} title={book.title} className="h-96 w-full rounded-[1.75rem] bg-slate-900 object-cover" />

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <GenrePill genre={book.genre} />
              <SentimentBadge sentiment={book.sentiment} />
              {book.availability ? <span className="badge bg-white/5 text-slate-300">{book.availability}</span> : null}
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-white">{book.title}</h2>
              <p className="mt-2 text-slate-400">{book.author || "Unknown"}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <StarRating rating={book.rating || 0} />
              {book.reviews ? <span className="text-sm text-slate-400">{book.reviews} reviews</span> : null}
              {book.price ? <span className="text-sm font-semibold text-brand-300">{book.price}</span> : null}
            </div>

            {book.description ? <p className="max-w-3xl text-sm leading-7 text-slate-300">{book.description}</p> : null}

            {book.book_url ? (
              <a
                href={book.book_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand-300 transition hover:text-brand-200"
              >
                View source page
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <InsightPanel book={book} />

      {related.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ScanSearch size={16} className="text-brand-300" />
            <h3 className="text-lg font-semibold text-white">Related books</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {related.slice(0, 3).map((item) => (
              <BookCard key={item.id} book={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
