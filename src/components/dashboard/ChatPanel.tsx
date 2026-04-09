"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchNews, fetchNewsByDate, type NewsRow } from "@/lib/queries";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  newsCards?: NewsRow[];
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
};

const LANGUAGES = [
  { code: "EN", flag: "🇬🇧", label: "English" },
  { code: "DE", flag: "🇩🇪", label: "Deutsch" },
  { code: "FR", flag: "🇫🇷", label: "Français" },
  { code: "ES", flag: "🇪🇸", label: "Español" },
  { code: "KR", flag: "🇰🇷", label: "한국어" },
  { code: "JP", flag: "🇯🇵", label: "日本語" },
  { code: "CN", flag: "🇨🇳", label: "中文" },
  { code: "PL", flag: "🇵🇱", label: "Polski" },
];

const COMMODITY_COLORS: Record<string, { fg: string; symbol: string }> = {
  copper: { fg: "#E87040", symbol: "Cu" },
  nickel: { fg: "#4CAF50", symbol: "Ni" },
  aluminium: { fg: "#2196F3", symbol: "Al" },
};

const SENTIMENT_WORDS = {
  positive: ["surge", "rise", "gain", "rally", "growth", "boost", "strong", "high", "record", "bullish", "recovery"],
  negative: ["fall", "drop", "decline", "loss", "cut", "weak", "low", "slump", "crash", "bearish", "risk", "threat"],
};

function getSentiment(title: string): { label: string; color: string; arrow: string } {
  const t = title.toLowerCase();
  let pos = 0, neg = 0;
  SENTIMENT_WORDS.positive.forEach((w) => { if (t.includes(w)) pos++; });
  SENTIMENT_WORDS.negative.forEach((w) => { if (t.includes(w)) neg++; });
  if (pos > neg) return { label: "Positive", color: "#4caf50", arrow: "▲" };
  if (neg > pos) return { label: "Negative", color: "#ef5350", arrow: "▼" };
  return { label: "Neutral", color: "#ffc107", arrow: "●" };
}

type Props = {
  activeCommodity: string;
  commodityName: string;
  selectedDate: string | null;
  dateClickCount?: number;
};

export function ChatPanel({ activeCommodity, commodityName, selectedDate, dateClickCount }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("EN");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [stickyNews, setStickyNews] = useState<NewsRow[]>([]);
  const [stickyLabel, setStickyLabel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load sticky news: date-specific if selected, otherwise 3 latest
  // dateClickCount forces re-fetch even when clicking the same date
  useEffect(() => {
    if (selectedDate) {
      const dateStr = new Date(selectedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
      setStickyLabel(`📅 ${dateStr}`);
      fetchNewsByDate(supabase, selectedDate, activeCommodity, 3).then(setStickyNews);
    } else {
      setStickyLabel(null);
      fetchNews(supabase, activeCommodity, 3).then(setStickyNews);
    }
  }, [selectedDate, activeCommodity, dateClickCount]);

  // New conversation
  function handleNew() {
    if (messages.length > 0) {
      const title = messages.find((m) => m.role === "user")?.content?.slice(0, 40) || "Untitled";
      setConversations((prev) => [
        { id: Date.now().toString(), title, messages, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    }
    setMessages([]);
    setError(null);
    setShowHistory(false);
  }

  // Load conversation from history
  function loadConversation(conv: Conversation) {
    setMessages(conv.messages);
    setShowHistory(false);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          commodity_slug: activeCommodity,
          selected_date: selectedDate,
          language: language,
          history: messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "Chat failed");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setIsSending(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + event.content } : m
                )
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2d3a] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Chat</span>
          <span className="text-[10px] text-gray-500">{commodityName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="flex items-center gap-1 rounded-md border border-[#3a3d4a] bg-[#252838] px-2 py-1 text-[10px] text-gray-400 hover:border-[#c9a44a]"
            >
              <span>{currentLang.flag}</span>
              <span>{currentLang.code}</span>
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-8 z-50 grid grid-cols-4 gap-1 rounded-lg border border-[#3a3d4a] bg-[#252838] p-2 shadow-xl">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.code); setShowLangPicker(false); }}
                    className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 transition-colors ${
                      language === l.code ? "bg-[#c9a44a]/20 text-[#c9a44a]" : "text-gray-400 hover:bg-[#1f2233]"
                    }`}
                    title={l.label}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span className="text-[8px] font-medium">{l.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New / History */}
          <button
            onClick={handleNew}
            className="rounded-md px-2 py-1 text-[10px] font-medium text-[#c9a44a] hover:bg-[#c9a44a]/10"
          >
            New
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium ${
              showHistory ? "bg-[#252838] text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            History ({conversations.length})
          </button>
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="border-b border-[#2a2d3a] bg-[#161822] px-4 py-2 max-h-[120px] overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-[10px] text-gray-700 py-2">No previous conversations</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] text-gray-400 hover:bg-[#1f2233]"
              >
                <span className="truncate">{c.title}</span>
                <span className="shrink-0 text-[9px] text-gray-700">
                  {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Sticky news section — doesn't scroll */}
      {stickyNews.length > 0 && (
        <div className="shrink-0 border-b border-[#2a2d3a] bg-[#161822] px-4 py-2.5">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            {stickyLabel ?? `Latest ${commodityName} News`}
          </p>
          <div className="space-y-1.5">
            {stickyNews.map((n, i) => (
              <NewsCard key={n.id} news={n} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {/* Empty state */}
        {messages.length === 0 && (
          <p className="py-4 text-center text-[10px] text-gray-700 italic">
            Ask about {commodityName} prices, trends, or news...
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}

        {/* Messages */}
        {messages.filter((m) => m.role !== "system").map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                m.role === "user"
                  ? "bg-[#c9a44a]/20 text-[#e8d5a0]"
                  : "bg-[#161822] text-gray-300 border border-[#2a2d3a]"
              }`}
            >
              {m.content || (
                <span className="inline-block animate-pulse text-gray-600">●●●</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-[#2a2d3a] px-3 py-2.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={`Ask about ${commodityName}...`}
          disabled={isSending}
          className="flex-1 rounded-xl border border-[#3a3d4a] bg-[#252838] px-3 py-2 text-xs text-gray-300 outline-none placeholder:text-gray-700 focus:border-[#c9a44a] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c9a44a] text-sm font-bold text-[#0f1117] transition-colors hover:bg-[#d4b45a] disabled:opacity-30"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

/** Compact news card inside chat */
function NewsCard({ news, rank }: { news: NewsRow; rank: number }) {
  const sentiment = getSentiment(news.title);
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#161822] border border-[#2a2d3a] px-3 py-2 hover:border-[#3a3d4a] transition-colors">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-gray-600">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-snug text-gray-300 line-clamp-2">{news.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex gap-0.5">
            {news.impacted_commodities.map((c) => {
              const info = COMMODITY_COLORS[c];
              return info ? (
                <span key={c} className="font-mono text-[8px] font-bold" style={{ color: info.fg }}>{info.symbol}</span>
              ) : null;
            })}
          </div>
          <span className="text-[9px] font-semibold" style={{ color: sentiment.color }}>
            {sentiment.arrow} {sentiment.label}
          </span>
          <span className="font-mono text-[9px] text-gray-700">
            {new Date(news.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
