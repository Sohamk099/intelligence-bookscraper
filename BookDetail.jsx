/**
 * BookDetail — full detail view for a single book.
 * Shows metadata, AI insights tabs, and related recommendations.
 */

import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ExternalLink, Star, BookOpen,
  Lightbulb, Tag, Heart, ThumbsUp,
} from "lucide-react";
import { fetchBookDetail, fetchRecommendations } from "../api/client.js";
import {
  LoadingState, ErrorBanner, StarRating,
  GenrePill, SentimentBadge, BookCover, Spinner,
} from "../components/UI.jsx";
import BookCard from "../components/BookCard.jsx";

// ── Insight tab content ───────────────────────────────────────────────────────
function InsightPanel({ book }) {
  const [tab, setTab] = useState("summary");

  const tabs = [
    { id: "summary",    label: "Summary",   icon: BookOpen },
    { id: "genre",      label: "Genre",     icon: Tag },
    { id: "sentiment",  label: "Sentiment", icon: Heart },
  ];

  // Pull insight content from the related insights array
  const getInsight = (type) =>
    book.insights?.find((i) => i.insight_type === type)?.content ?? "";

  const tabContent = {
    summary:   getInsight("summary")   || book.summary   || "No summary generated yet.",
    genre:     getInsight("genre")     || book.genre     || "Genre not classified yet.",
    sentiment: getInsight("sentiment") || "Sentiment analysis not available.",
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-1.5">
        <Lightbulb size={15} className="text-brand-400" />
        <h3 className="font-semibold text-slate-200 text-sm">AI Insights</h3>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800 pb-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-t-lg border-b-2 transition-colors ${
              tab === id
                ? "border-brand-500 text-brand-300 bg-brand-950/30"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {tabContent[tab]}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook]     = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [bookData, relData] = await Promise.all([
          fetchBookDetail(id),
          fetchRecommendations(id).catch(() => []),
        ]);
        setBook(bookData);
        setRelated(Array.isArray(relData) ? relData : relData.results ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingState message="Loading book details…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!book) return null;

  return (
    <div className="space-y-10">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Library
      </button>

      {/* Hero section */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Cover */}
        <div className="shrink-0">
          <BookCover
            src={book.cover_image_url}
            title={book.title}
            className="w-48 h-64 rounded-2xl shadow-2xl shadow-slate-900"
          />
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <GenrePill genre={book.genre} />
            <SentimentBadge sentiment={book.sentiment} />
            {book.availability && (
              <span className="badge bg-slate-800 text-slate-300 border border-slate-700">
                {book.availability}
              </span>
            )}
          </div>

          {/* Title / author */}
          <div>
            <h1 className="text-3xl font-bold text-slate-100 leading-tight">
              {book.title}
            </h1>
            {book.author && book.author !== "Unknown" && (
              <p className="text-slate-400 mt-1">{book.author}</p>
            )}
          </div>

          {/* Rating + price row */}
          <div className="flex flex-wrap items-center gap-4">
            {book.rating && <StarRating rating={book.rating} />}
            {book.reviews > 0 && (
              <span className="text-sm text-slate-500">
                {book.reviews} reviews
              </span>
            )}
            {book.price && (
              <span className="text-brand-400 font-semibold">{book.price}</span>
            )}
          </div>

          {/* Description */}
          {book.description && (
            <p className="text-slate-300 text-sm leading-relaxed max-w-prose">
              {book.description}
            </p>
          )}

          {/* External link */}
          {book.book_url && (
            <a
              href={book.book_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors w-fit"
            >
              View on source site <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* AI insights panel */}
      <InsightPanel book={book} />

      {/* Recommendations */}
      {related.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ThumbsUp size={15} className="text-brand-400" />
            <h2 className="font-semibold text-slate-200">
              You might also like
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {related.slice(0, 4).map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
