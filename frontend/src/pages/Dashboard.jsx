import { useEffect, useMemo, useState } from "react";
import { BookOpen, BrainCircuit, Download, RefreshCw, Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { fetchBooks } from "../api/client.js";
import BookCard from "../components/BookCard.jsx";
import ScrapeModal from "../components/ScrapeModal.jsx";
import { EmptyState, ErrorBanner, LoadingState } from "../components/UI.jsx";


const GENRES = [
  "All",
  "Mystery",
  "Historical Fiction",
  "Classics",
  "Romance",
  "Fantasy",
  "Science Fiction",
  "Horror",
  "Travel",
  "Nonfiction",
];

export default function Dashboard() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [showScrape, setShowScrape] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = {};
        if (search.trim()) params.search = search.trim();
        if (genre !== "All") params.genre = genre;

        const data = await fetchBooks(params);
        setBooks(Array.isArray(data) ? data : data.results ?? []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [search, genre]);

  const stats = useMemo(() => {
    return {
      total: books.length,
      aiProcessed: books.filter((book) => book.genre || book.sentiment).length,
      genres: new Set(books.map((book) => book.genre).filter(Boolean)).size,
    };
  }, [books]);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBooks();
      setBooks(Array.isArray(data) ? data : data.results ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="card relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-400/10 blur-3xl" />
          <p className="text-xs uppercase tracking-[0.28em] text-brand-300">Overview</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-white">
            Turn a scraped catalogue into a sharp, queryable intelligence surface.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Browse books, enrich them with AI summaries and classifications, and use natural-language Q and A against the full collection from one interface.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Sparkles size={13} className="text-brand-300" />
              NVIDIA-backed insights
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <BrainCircuit size={13} className="text-brand-300" />
              Retrieval-style Q and A
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setShowScrape(true)} className="btn-primary gap-2">
              <Download size={16} />
              Scrape books
            </button>
            <button onClick={reload} className="btn-ghost gap-2">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Visible Books", value: stats.total },
            { label: "AI Processed", value: stats.aiProcessed },
            { label: "Genres Seen", value: stats.genres },
            { label: "Source", value: "books.toscrape.com" },
          ].map((item) => (
            <div key={item.label} className="card p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
              <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input-field pl-11"
              placeholder="Search by title or author"
            />
          </div>

          <div className="relative lg:w-64">
            <SlidersHorizontal size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <select value={genre} onChange={(event) => setGenre(event.target.value)} className="input-field pl-11">
              {GENRES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <LoadingState message="Loading books..." />
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books found"
          description="Start by scraping the sample catalogue, or adjust your search and filters."
          action={<button onClick={() => setShowScrape(true)} className="btn-primary">Open scraper</button>}
        />
      ) : (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </section>
      )}

      {showScrape ? <ScrapeModal onClose={() => setShowScrape(false)} onSuccess={() => { setShowScrape(false); reload(); }} /> : null}
    </div>
  );
}
