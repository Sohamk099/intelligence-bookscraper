import { AlertCircle, LoaderCircle, Star } from "lucide-react";


export function Spinner({ size = 16 }) {
  return <LoaderCircle size={size} className="animate-spin text-brand-400" />;
}

export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="card flex min-h-[18rem] items-center justify-center p-8">
      <div className="flex items-center gap-3 text-slate-300">
        <Spinner size={18} />
        <span>{message}</span>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <div className="flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card flex min-h-[20rem] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-3xl bg-white/5 p-5">
        <Icon size={28} className="text-brand-300" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="max-w-md text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

export function StarRating({ rating = 0 }) {
  const value = Math.round(Number(rating) || 0);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={14}
            className={index < value ? "fill-amber-300 text-amber-300" : "text-slate-700"}
          />
        ))}
      </div>
      <span className="text-sm text-slate-400">{rating}/5</span>
    </div>
  );
}

export function GenrePill({ genre }) {
  return <span className="badge bg-brand-500/15 text-brand-300">{genre || "Unclassified"}</span>;
}

export function SentimentBadge({ sentiment }) {
  const normalized = (sentiment || "neutral").toLowerCase();
  const classes =
    normalized === "positive"
      ? "bg-emerald-500/15 text-emerald-300"
      : normalized === "negative"
        ? "bg-rose-500/15 text-rose-300"
        : "bg-slate-700/60 text-slate-300";
  return <span className={`badge ${classes}`}>{normalized}</span>;
}

export function BookCover({ src, title, className = "" }) {
  if (src) {
    return <img src={src} alt={title} className={`object-cover ${className}`} />;
  }

  return (
    <div className={`flex items-center justify-center bg-slate-900 text-center text-sm text-slate-500 ${className}`}>
      <span className="max-w-[9rem] px-3">{title}</span>
    </div>
  );
}
