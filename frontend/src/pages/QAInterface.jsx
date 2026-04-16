import { useEffect, useRef, useState } from "react";
import { BookOpen, Bot, ChevronDown, Clock, MessageSquare, Send, Sparkles, User } from "lucide-react";
import { Link } from "react-router-dom";

import { askQuestion, fetchChatHistory } from "../api/client.js";
import { ErrorBanner, Spinner } from "../components/UI.jsx";


const SAMPLE_QUESTIONS = [
  "What are the best mystery books in the collection?",
  "Can you recommend books similar to classic literature?",
  "Which books have the highest ratings?",
  "What fantasy books are available?",
  "Tell me about books with positive sentiment",
];

function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Bot size={16} className="text-brand-300" />
        </div>
      ) : null}

      <div className={`max-w-3xl rounded-[1.5rem] px-4 py-3 ${isUser ? "bg-brand-500 text-slate-950" : "bg-slate-900 text-slate-100"}`}>
        <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>

        {message.sources?.length ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 flex items-center gap-1 text-xs text-slate-400">
              <BookOpen size={12} />
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, index) => (
                <Link
                  key={`${source.title}-${index}`}
                  to={source.book_id ? `/books/${source.book_id}` : "#"}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10 hover:text-brand-300"
                >
                  {source.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isUser ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500">
          <User size={16} className="text-slate-950" />
        </div>
      ) : null}
    </div>
  );
}

export default function QAInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topK, setTopK] = useState(5);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchChatHistory()
      .then((data) => setHistory(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (presetText) => {
    const question = (presetText || input).trim();
    if (!question) return;

    setInput("");
    setError("");
    setMessages((current) => [...current, { role: "user", content: question }]);
    setLoading(true);

    try {
      const result = await askQuestion(question, topK);
      setMessages((current) => [...current, { role: "assistant", content: result.answer, sources: result.sources }]);
      setHistory((current) => [
        { id: `live-${Date.now()}`, question, answer: result.answer, sources: result.sources, created_at: new Date().toISOString() },
        ...current,
      ]);
    } catch (sendError) {
      setError(sendError.message);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="card flex min-h-[70vh] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-brand-500/15 p-3">
              <Sparkles size={18} className="text-brand-300" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Book AI assistant</h2>
              <p className="text-sm text-slate-400">Ask questions against the scraped library with cited sources.</p>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-400">
            Context chunks
            <select value={topK} onChange={(event) => setTopK(Number(event.target.value))} className="input-field w-24 py-2">
              {[3, 5, 8, 10].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-panel">
                <MessageSquare size={28} className="text-brand-300" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Ask anything about the books</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                The assistant searches the stored collection, then answers with book citations when available.
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {SAMPLE_QUESTIONS.map((question) => (
                  <button key={question} onClick={() => sendMessage(question)} className="btn-ghost">
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}

          {loading ? (
            <div className="flex items-center gap-3 text-slate-300">
              <Spinner size={16} />
              <span className="text-sm">Generating answer...</span>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="px-5 pb-3">
            <ErrorBanner message={error} />
          </div>
        ) : null}

        <div className="border-t border-white/10 p-4">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              className="input-field min-h-24 resize-none"
              placeholder="Ask a question about the library..."
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="btn-primary h-12 w-12 rounded-2xl p-0">
              {loading ? <Spinner size={16} /> : <Send size={18} />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Press Enter to send. Use Shift+Enter for a new line.</p>
        </div>
      </section>

      <aside className="card overflow-hidden">
        <button onClick={() => setShowHistory((current) => !current)} className="flex w-full items-center justify-between border-b border-white/10 px-4 py-4 text-left">
          <span className="flex items-center gap-2 text-sm font-medium text-white">
            <Clock size={15} className="text-brand-300" />
            Chat history
          </span>
          <ChevronDown size={16} className={`text-slate-400 transition ${showHistory ? "rotate-180" : ""}`} />
        </button>

        {showHistory ? (
          <div className="max-h-[70vh] overflow-y-auto">
            {history.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No history yet.</p>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    setMessages([
                      { role: "user", content: item.question },
                      { role: "assistant", content: item.answer, sources: item.sources },
                    ])
                  }
                  className="block w-full border-b border-white/5 px-4 py-4 text-left transition hover:bg-white/5"
                >
                  <p className="line-clamp-2 text-sm font-medium text-slate-200">{item.question}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.answer}</p>
                </button>
              ))
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
