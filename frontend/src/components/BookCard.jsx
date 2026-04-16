import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { BookCover, GenrePill, SentimentBadge, StarRating } from "./UI.jsx";


export default function BookCard({ book }) {
  return (
    <article className="card group relative overflow-hidden transition duration-300 hover:-translate-y-1">
      <div className="absolute inset-x-5 top-0 h-24 bg-gradient-to-b from-brand-400/10 to-transparent blur-2xl" />
      <div className="relative p-4">
        <BookCover
          src={book.cover_image_url}
          title={book.title}
          className="h-72 w-full rounded-[1.25rem] bg-slate-900 object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="relative space-y-4 p-5 pt-0">
        <div className="flex flex-wrap gap-2">
          <GenrePill genre={book.genre} />
          <SentimentBadge sentiment={book.sentiment} />
        </div>

        <div>
          <Link to={`/books/${book.id}`} className="line-clamp-2 text-lg font-semibold text-white hover:text-brand-300">
            {book.title}
          </Link>
          <p className="mt-1 text-sm text-slate-400">{book.author || "Unknown"}</p>
        </div>

        {book.description ? (
          <p className="line-clamp-3 text-sm leading-6 text-slate-400">{book.description}</p>
        ) : (
          <p className="text-sm text-slate-500">No description available yet.</p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-4">
          <StarRating rating={book.rating || 0} />
          {book.price ? <span className="text-sm font-semibold text-brand-300">{book.price}</span> : null}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Link to={`/books/${book.id}`} className="btn-primary">
            View Details
          </Link>
          {book.book_url ? (
            <a
              href={book.book_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-brand-300"
            >
              Source <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
