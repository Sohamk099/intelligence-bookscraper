/**
 * QAInterface — RAG-powered Q&A page with chat history.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Send, MessageSquare, BookOpen, Clock,
  User, Bot, ChevronDown, Sparkles,
} from "lucide-react";
import { askQuestion, fetchChatHistory } from "../api/client.js";
import { Spinner, ErrorBanner } from "../components/UI.jsx";
import { Link } from "react-router-dom";

// ─── Sample questions ─────────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  "What are the best mystery books in the collection?",
  "Can you recommend books similar to classic literature?",
  "Which books have the highest ratings?",
  "What fantasy books are available?",
  "Tell me about books with positive sentiment",
];

// ─── Single chat message ──────────────────────────────────────────────────────
function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-brand-600" : "bg-slate-700"
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-slate-300" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-2 ${
          isUser
            ? "bg-brand-600 text-white rounded-tr-sm"
            : "bg-slate-800 text-slate-200 rounded-tl-sm"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="pt-2 border-t border-slate-700 space-y-1.5">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <BookOpen size={11} /> Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((s, i) => (
                <Link
                  key={i}
                  to={s.book_id ? `/books/${s.book_id}` : "#"}
                  className="text-xs bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 hover:text-brand-300 px-2 py-0.5 rounded-md transition-colors"
                >
                  {s.title}
                  {s.relevance && (
                    <span className="ml-1 text-slate-500">
                      ({Math.round(s.relevance * 100)}%)
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <p className={`text-xs ${isUser ? "text-brand-200" : "text-slate-500"}`}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function QAInterface() {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [topK, setTopK]           = useState(5);
  const [history, setHistory]     = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load past Q&A history
  useEffect(() => {
    fetchChatHistory()
      .then((data) =>
        setHistory(Array.isArray(data) ? data : data.results ?? [])
      )
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question) return;

    setInput("");
    setError("");

    // Append user bubble immediately
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, timestamp: new Date().toISOString() },
    ]);

    setLoading(true);
    try {
      const result = await askQuestion(question, topK);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setError(e.message);
      // Remove the user bubble if request failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* ── Main chat panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 card overflow-hidden">
        {/* Chat header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Sparkles size={15} className="text-brand-400" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm">Book AI Assistant</h1>
              <p className="text-xs text-slate-500">RAG-powered Q&A</p>
            </div>
          </div>

          {/* Top-K control */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Context chunks:</span>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs"
            >
              {[3, 5, 8, 10].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/10 flex items-center justify-center">
                <MessageSquare size={28} className="text-brand-400" />
              </div>
              <div>
                <p className="text-slate-300 font-medium">Ask anything about the books</p>
                <p className="text-slate-500 text-sm mt-1">
                  The AI searches the library and answers with citations.
                </p>
              </div>

              {/* Sample questions */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-slate-100 rounded-full px-3 py-1.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <Bot size={14} className="text-slate-300" />
              </div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Spinner size={14} />
                <span className="text-sm text-slate-400">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 pb-3">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* Input bar */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about the books… (Enter to send)"
              rows={2}
              disabled={loading}
              className="input-field resize-none text-sm flex-1 py-3"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="btn-primary p-3 rounded-xl shrink-0"
            >
              {loading ? <Spinner size={16} /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1.5 ml-1">
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>

      {/* ── History sidebar ──────────────────────────────────────────────────── */}
      <div className="w-full lg:w-72 card flex flex-col overflow-hidden">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="px-4 py-3 border-b border-slate-800 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock size={14} className="text-slate-500" />
            Chat History
            <span className="bg-slate-700 text-slate-400 text-xs rounded-full px-1.5">
              {history.length}
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform ${showHistory ? "rotate-180" : ""}`}
          />
        </button>

        {(showHistory || window.innerWidth >= 1024) && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">
                No history yet
              </p>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    setMessages([
                      { role: "user", content: item.question, timestamp: item.created_at },
                      {
                        role: "assistant",
                        content: item.answer,
                        sources: item.sources,
                        timestamp: item.created_at,
                      },
                    ])
                  }
                  className="w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors space-y-1"
                >
                  <p className="text-xs font-medium text-slate-300 line-clamp-2">
                    {item.question}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {item.answer}
                  </p>
                  <p className="text-xs text-slate-600">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
