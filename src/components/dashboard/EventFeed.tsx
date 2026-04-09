"use client";

import { useState } from "react";
import type { NewsRow } from "@/lib/queries";

const COMMODITY_COLORS: Record<string, { bg: string; fg: string; symbol: string }> = {
  copper: { bg: "#E8704020", fg: "#E87040", symbol: "Cu" },
  nickel: { bg: "#4CAF5020", fg: "#4CAF50", symbol: "Ni" },
  aluminium: { bg: "#2196F320", fg: "#2196F3", symbol: "Al" },
};

/**
 * Get sentiment — uses FinBERT from DB if available, falls back to keywords.
 */
function getSentiment(
  title: string,
  summary: string | null,
  finbertLabel: string | null,
  finbertScore: number | null
): { label: string; color: string; score: number } {
  // Use FinBERT if available
  if (finbertLabel && finbertScore !== null) {
    const score = finbertScore;
    if (finbertLabel === "positive" && score > 0.5) return { label: "Very positive", color: "#4caf50", score };
    if (finbertLabel === "positive") return { label: "Positive", color: "#8bc34a", score };
    if (finbertLabel === "negative" && score < -0.5) return { label: "Very negative", color: "#ef5350", score };
    if (finbertLabel === "negative") return { label: "Negative", color: "#ff9800", score };
    return { label: "Neutral", color: "#ffc107", score: 0 };
  }

  // Keyword fallback for articles without FinBERT scores
  const KEYWORDS_POS = ["surge", "rise", "gain", "rally", "growth", "boost", "strong", "high", "record", "bullish", "recovery"];
  const KEYWORDS_NEG = ["fall", "drop", "decline", "loss", "cut", "weak", "low", "slump", "crash", "bearish", "risk", "threat"];

  const text = (title + " " + (summary ?? "")).toLowerCase();
  let pos = 0, neg = 0;
  KEYWORDS_POS.forEach((w) => { if (text.includes(w)) pos++; });
  KEYWORDS_NEG.forEach((w) => { if (text.includes(w)) neg++; });

  const total = pos + neg || 1;
  const score = (pos - neg) / total;

  if (score > 0.3) return { label: "Very positive", color: "#4caf50", score };
  if (score > 0) return { label: "Positive", color: "#8bc34a", score };
  if (score < -0.3) return { label: "Negative", color: "#ef5350", score };
  if (score < 0) return { label: "Slightly negative", color: "#ff9800", score };
  return { label: "Neutral", color: "#ffc107", score: 0 };
}

function getEventTypes(title: string): { label: string; type: "gain" | "loss" | "flat" }[] {
  const t = title.toLowerCase();
  const types: { label: string; type: "gain" | "loss" | "flat" }[] = [];
  if (t.includes("surge") || t.includes("rise") || t.includes("gain") || t.includes("rally")) types.push({ label: "Movement up", type: "gain" });
  if (t.includes("fall") || t.includes("drop") || t.includes("decline") || t.includes("loss")) types.push({ label: "Movement down", type: "loss" });
  if (t.includes("flat") || t.includes("steady") || t.includes("unchanged")) types.push({ label: "Movement flat", type: "flat" });
  if (t.includes("supply") || t.includes("output") || t.includes("production")) types.push({ label: "Supply", type: types.some(t => t.type === "loss") ? "loss" : "gain" });
  if (t.includes("demand") || t.includes("import") || t.includes("consumption")) types.push({ label: "Demand", type: "gain" });
  if (types.length === 0) types.push({ label: "Market event", type: "flat" });
  return types.slice(0, 2);
}

function getSource(url: string | null): { name: string; bg: string; fg: string } {
  if (!url) return { name: "Unknown", bg: "#252838", fg: "#666" };
  const u = url.toLowerCase();
  if (u.includes("reuters")) return { name: "Reuters", bg: "#1a3a5f", fg: "#60a5fa" };
  if (u.includes("bloomberg")) return { name: "Bloomberg", bg: "#3b2a1a", fg: "#d4a574" };
  if (u.includes("metal.com") || u.includes("metals")) return { name: "Metal.com", bg: "#2a1a3a", fg: "#c084fc" };
  if (u.includes("nasdaq")) return { name: "Nasdaq", bg: "#1a3a2e", fg: "#4ade80" };
  if (u.includes("wsj") || u.includes("wall")) return { name: "WSJ", bg: "#3a2a1a", fg: "#f59e0b" };
  if (u.includes("canada") || u.includes("globe")) return { name: "GlobeMail", bg: "#1a2a3a", fg: "#60a5fa" };
  return { name: "News", bg: "#252838", fg: "#888" };
}

type Props = {
  news: NewsRow[];
  commodityFilter: string | null;
  onFilterChange: (slug: string | null) => void;
};

export function EventFeed({ news, commodityFilter, onFilterChange }: Props) {
  const [dateFilter, setDateFilter] = useState("all");

  const filtered = news.filter((n) => {
    if (dateFilter === "today") {
      const today = new Date().toISOString().split("T")[0];
      return n.date.startsWith(today);
    }
    if (dateFilter === "7d") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      return new Date(n.date) >= since;
    }
    return true;
  });

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2d3a] px-5 py-4">
        <span className="text-base font-semibold text-white">Event Feed</span>
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wide text-gray-600">Material</span>
            <select
              value={commodityFilter ?? "all"}
              onChange={(e) => onFilterChange(e.target.value === "all" ? null : e.target.value)}
              className="rounded-md border border-[#3a3d4a] bg-[#252838] px-3 py-1.5 text-xs text-gray-300 outline-none"
            >
              <option value="all">All</option>
              <option value="copper_lme">Copper</option>
              <option value="nickel_lme">Nickel</option>
              <option value="aluminium_lme">Aluminium</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wide text-gray-600">Event date</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-[#3a3d4a] bg-[#252838] px-3 py-1.5 text-xs text-gray-300 outline-none"
            >
              <option value="all">All</option>
              <option value="7d">7 days</option>
              <option value="today">Today</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#161822]">
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Date</th>
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Material</th>
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Headline</th>
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Source</th>
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Event Types</th>
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Sentiment</th>
              <th className="border-b border-[#2a2d3a] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 15).map((n) => {
              const sentiment = getSentiment(n.title, n.summary, n.finbert_label, n.finbert_sentiment_score);
              const eventTypes = getEventTypes(n.title);
              const source = getSource(n.url);
              const dateStr = new Date(n.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });

              // Breakdown bar: compute from sentiment score
              const posW = Math.max(10, 50 + sentiment.score * 40);
              const negW = Math.max(10, 50 - sentiment.score * 40);

              return (
                <tr key={n.id} className="transition-colors hover:bg-[#1f2233]">
                  <td className="border-b border-[#1f2233] px-4 py-3 font-mono text-[11px] text-gray-600">{dateStr}</td>
                  <td className="border-b border-[#1f2233] px-4 py-3">
                    <div className="flex gap-1">
                      {n.impacted_commodities.map((c) => {
                        const info = COMMODITY_COLORS[c] ?? { bg: "#252838", fg: "#666", symbol: "?" };
                        return (
                          <span
                            key={c}
                            className="inline-flex h-6 w-6 items-center justify-center rounded font-mono text-[9px] font-bold"
                            style={{ backgroundColor: info.bg, color: info.fg }}
                          >
                            {info.symbol}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="max-w-[280px] truncate border-b border-[#1f2233] px-4 py-3 text-xs text-gray-300">
                    {n.title}
                  </td>
                  <td className="border-b border-[#1f2233] px-4 py-3">
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: source.bg, color: source.fg }}
                    >
                      {source.name}
                    </span>
                  </td>
                  <td className="border-b border-[#1f2233] px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {eventTypes.map((et, i) => (
                        <span
                          key={i}
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            et.type === "gain"
                              ? "bg-green-500/10 text-green-400"
                              : et.type === "loss"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-yellow-500/10 text-yellow-400"
                          }`}
                        >
                          {et.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="border-b border-[#1f2233] px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sentiment.color }} />
                      <span className="text-[11px]" style={{ color: sentiment.color }}>{sentiment.label}</span>
                    </div>
                  </td>
                  <td className="border-b border-[#1f2233] px-4 py-3">
                    <div className="flex h-2 w-[100px] overflow-hidden rounded-full">
                      <div className="h-full bg-green-500" style={{ width: `${posW}%` }} />
                      <div className="h-full bg-yellow-500" style={{ width: `${100 - posW - negW + 20}%` }} />
                      <div className="h-full bg-red-500" style={{ width: `${negW}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
