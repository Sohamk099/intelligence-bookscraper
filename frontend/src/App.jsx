import { BookOpenText, DatabaseZap, MessageSquareText, Sparkles } from "lucide-react";
import { NavLink, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import BookDetail from "./pages/BookDetail.jsx";
import QAInterface from "./pages/QAInterface.jsx";


function NavItem({ to, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
          isActive
            ? "bg-brand-500 text-slate-950"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      <Icon size={16} />
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#204438_0%,#0c1117_40%,#05070a_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-[-10rem] top-[-6rem] h-72 w-72 rounded-full bg-brand-500/18 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-emerald-300/8 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 px-6 py-6 shadow-panel backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-brand-300">Book Intelligence Platform</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Scrape collections, extract signals, and ask better questions.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                A full-stack interface for harvesting book data, enriching it with AI, and turning the result into a searchable research surface.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: DatabaseZap, label: "Structured API", value: "Django + REST" },
                { icon: Sparkles, label: "AI Layer", value: "NVIDIA Enabled" },
                { icon: BookOpenText, label: "UX", value: "Research-grade UI" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
                  <Icon size={16} className="text-brand-300" />
                  <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            <NavItem to="/" icon={BookOpenText}>Library</NavItem>
            <NavItem to="/ask" icon={MessageSquareText}>Q and A</NavItem>
          </nav>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/books/:id" element={<BookDetail />} />
            <Route path="/ask" element={<QAInterface />} />
          </Routes>
        </main>

        <footer className="mt-8 flex flex-col gap-2 border-t border-white/10 px-2 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Built for a polished book intelligence workflow.</p>
          <p className="text-slate-400">Developed by Soham</p>
        </footer>
      </div>
    </div>
  );
}
