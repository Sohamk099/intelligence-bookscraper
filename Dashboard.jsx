/**
 * Dashboard — main book listing page.
 * Features: search, genre filter, scrape trigger, paginated grid.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, RefreshCw, BookOpen, Download } from "lucide-react";
import { fetchBooks } from "../api/client.js";
import BookCard from "../components/BookCard.jsx";
import ScrapeModal from "../components/ScrapeModal.jsx";
import {
  LoadingState,
  ErrorBanner,
  EmptyState,
  SectionHeading,
} from "../components/UI.jsx";

const GENRES = [
  "All", "Mystery", "Historical Fiction", "Classics", "Romance",
  "Fantasy", "Science Fiction", "Horror", "Travel", "Nonfiction",
];

export default function Dashboard() {
  const [books, setBooks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [genre, setGenre]           = useState("All");
  const [showScrape, setShowScrape] = useState(false);
  const [stats, setStats]           = useState(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (genre !== "All") params.genre = genre;

      const data = await fetchBooks(params);

      // data may be paginated (DRF) or a plain array
      const results = Array.isArray(data) ? data : data.results ?? [];
      setBooks(results);

      if (!stats) {
        // Compute basic stats from the full unfiltered list
        setStats({
          total: data.count ?? results.length,
          withInsights: results.filter((b) => b.genre || b.sentiment).length,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, genre]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleScrapeSuccess = () => {
    setShowScrape(false);
    loadBooks();
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Book Library</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {stats
              ? `${stats.total} books · ${stats.withInsights} with AI insights`
              : "Browse and explore the collection"}
          </p>
        </div>
        <button
          onClick={() => setShowScrape(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Download size={15} />
          Scrape Books
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Books", value: stats.total },
            { label: "AI Processed", value: stats.withInsights },
            { label: "Genres", value: GENRES.length - 1 },
            { label: "Data Source", value: "books.toscrape.com" },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author…"
            className="input-field pl-9 text-sm"
          />
        </div>

        {/* Genre filter */}
        <div className="relative">
          <SlidersHorizontal
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="input-field pl-8 pr-8 text-sm appearance-none cursor-pointer w-full sm:w-48"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={loadBooks}
          className="btn-ghost flex items-center gap-2 text-sm"
          title="Refresh"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading books…" />
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books found"
          description={
            search || genre !== "All"
              ? "Try adjusting your search or filter."
              : "Click 'Scrape Books' to populate the library."
          }
          action={
            <button
              onClick={() => setShowScrape(true)}
              className="btn-primary mt-2"
            >
              Scrape Books
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      {/* Scrape modal */}
      {showScrape && (
        <ScrapeModal
          onClose={() => setShowScrape(false)}
          onSuccess={handleScrapeSuccess}
        />
      )}
    </div>
  );
}
