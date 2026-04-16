import { useState } from "react";
import { X } from "lucide-react";

import { triggerScrape } from "../api/client.js";
import { ErrorBanner, Spinner } from "./UI.jsx";


export default function ScrapeModal({ onClose, onSuccess }) {
  const [url, setUrl] = useState("https://books.toscrape.com");
  const [maxPages, setMaxPages] = useState(3);
  const [generateInsights, setGenerateInsights] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await triggerScrape({
        url,
        max_pages: Number(maxPages),
        generate_insights: generateInsights,
      });
      onSuccess();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Scrape books</h2>
            <p className="mt-1 text-sm text-slate-400">Fetch books from a catalogue and generate local or AI insights.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Source URL</span>
            <input className="input-field" value={url} onChange={(event) => setUrl(event.target.value)} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Pages to scrape</span>
            <input
              type="number"
              min="1"
              max="20"
              className="input-field"
              value={maxPages}
              onChange={(event) => setMaxPages(event.target.value)}
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={generateInsights}
              onChange={(event) => setGenerateInsights(event.target.checked)}
            />
            Generate summaries, genre, and sentiment after scraping
          </label>

          {error ? <ErrorBanner message={error} /> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary min-w-32">
              {loading ? <Spinner size={16} /> : "Start scrape"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
