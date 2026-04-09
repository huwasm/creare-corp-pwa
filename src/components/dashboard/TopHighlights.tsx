"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchNews, type NewsRow } from "@/lib/queries";

const SENTIMENT_KEYWORDS = {
  positive: ["surge", "rise", "gain", "rally", "growth", "boost", "strong", "high", "record", "expand", "bullish", "recovery"],
  negative: ["fall", "drop", "decline", "loss", "cut", "weak", "low", "slump", "crash", "bearish", "concern", "risk", "threat"],
};

function getSentimentScore(title: string, summary: string | null): number {
  const t = (title + " " + (summary ?? "")).toLowerCase();
  let pos = 0, neg = 0;
  SENTIMENT_KEYWORDS.positive.forEach((w) => { if (t.includes(w)) pos++; });
  SENTIMENT_KEYWORDS.negative.forEach((w) => { if (t.includes(w)) neg++; });
  return pos - neg;
}

const COMMODITY_COLORS: Record<string, { fg: string; symbol: string }> = {
  copper: { fg: "#E87040", symbol: "Cu" },
  nickel: { fg: "#4CAF50", symbol: "Ni" },
  aluminium: { fg: "#2196F3", symbol: "Al" },
};

type Props = {
  activeCommodity: string;
};

export function TopHighlights({ activeCommodity }: Props) {
  const [highlights, setHighlights] = useState<NewsRow[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Fetch recent news, then pick top 5 by sentiment strength
      const commodity = activeCommodity.replace("_lme", "");
      const news = await fetchNews(supabase, activeCommodity, 50);
      const scored = news
        .map((n) => ({ ...n, score: Math.abs(getSentimentScore(n.title, n.summary)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setHighlights(scored);
    }
    load();
  }, [activeCommodity]);

  return (
    <div className="flex flex-col">
      <div className="border-b border-[#2a2d3a] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Top Highlights</h3>
        <p className="mt-0.5 text-[10px] text-gray-600">Most impactful recent events</p>
      </div>

      <div className="overflow-y-auto px-4 py-2">
        {highlights.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-700">Loading...</p>
        ) : (
          <div className="space-y-1.5">
            {highlights.map((n, i) => {
              const score = getSentimentScore(n.title, n.summary);
              const isPositive = score > 0;
              const isNegative = score < 0;

              return (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 rounded-lg border border-[#2a2d3a] bg-[#161822] px-3 py-2 transition-colors hover:border-[#3a3d4a]"
                >
                  {/* Rank */}
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold text-gray-600">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* Title */}
                    <p className="text-[11px] leading-snug text-gray-300 line-clamp-2">
                      {n.title}
                    </p>

                    {/* Meta */}
                    <div className="mt-1 flex items-center gap-2">
                      {/* Commodity tags */}
                      <div className="flex gap-0.5">
                        {n.impacted_commodities.map((c) => {
                          const info = COMMODITY_COLORS[c];
                          return info ? (
                            <span key={c} className="font-mono text-[8px] font-bold" style={{ color: info.fg }}>
                              {info.symbol}
                            </span>
                          ) : null;
                        })}
                      </div>

                      {/* Sentiment indicator */}
                      <span
                        className={`text-[9px] font-semibold ${
                          isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-yellow-400"
                        }`}
                      >
                        {isPositive ? "▲ Positive" : isNegative ? "▼ Negative" : "● Neutral"}
                      </span>

                      {/* Date */}
                      <span className="font-mono text-[9px] text-gray-700">
                        {new Date(n.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
