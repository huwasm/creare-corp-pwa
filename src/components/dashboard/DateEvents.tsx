"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchNewsByDate, type NewsRow } from "@/lib/queries";

const COMMODITY_COLORS: Record<string, { bg: string; fg: string; symbol: string }> = {
  copper: { bg: "#E8704020", fg: "#E87040", symbol: "Cu" },
  nickel: { bg: "#4CAF5020", fg: "#4CAF50", symbol: "Ni" },
  aluminium: { bg: "#2196F320", fg: "#2196F3", symbol: "Al" },
};

const SENTIMENT_KEYWORDS = {
  positive: ["surge", "rise", "gain", "rally", "growth", "boost", "strong", "high", "record", "expand", "optimis", "bullish", "recovery", "demand"],
  negative: ["fall", "drop", "decline", "loss", "cut", "weak", "low", "slump", "crash", "downturn", "pessimis", "bearish", "concern", "risk", "threat"],
};

function getSentiment(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  let pos = 0, neg = 0;
  SENTIMENT_KEYWORDS.positive.forEach((w) => { if (t.includes(w)) pos++; });
  SENTIMENT_KEYWORDS.negative.forEach((w) => { if (t.includes(w)) neg++; });
  if (pos > neg) return { label: "Positive", color: "#4caf50" };
  if (neg > pos) return { label: "Negative", color: "#ef5350" };
  return { label: "Neutral", color: "#ffc107" };
}

type Props = {
  selectedDate: string | null;
  activeCommodity: string;
  commodityName: string;
};

export function DateEvents({ selectedDate, activeCommodity, commodityName }: Props) {
  const [news, setNews] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!selectedDate) {
      setNews([]);
      return;
    }
    setLoading(true);
    fetchNewsByDate(supabase, selectedDate, activeCommodity, 15).then((data) => {
      setNews(data);
      setLoading(false);
    });
  }, [selectedDate, activeCommodity]);

  const formattedDate = selectedDate
    ? new Date(selectedDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[#2a2d3a] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">
          {selectedDate ? `Events — ${formattedDate}` : "Events"}
        </h3>
        {selectedDate && (
          <p className="mt-0.5 text-[10px] text-gray-600">{commodityName} related news</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!selectedDate && (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-[200px] text-center text-xs text-gray-600">
              Click a data point on the chart to see related news for that date
            </p>
          </div>
        )}

        {selectedDate && loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-gray-600">Loading...</p>
          </div>
        )}

        {selectedDate && !loading && news.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-[200px] text-center text-xs text-gray-600">
              No news found for {formattedDate}
            </p>
          </div>
        )}

        {selectedDate && !loading && news.length > 0 && (
          <div className="space-y-2.5">
            {news.map((n) => {
              const sentiment = getSentiment(n.title);
              return (
                <div
                  key={n.id}
                  className="rounded-lg border border-[#2a2d3a] bg-[#161822] p-3 transition-colors hover:border-[#3a3d4a]"
                >
                  {/* Commodity tags + sentiment */}
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex gap-1">
                      {n.impacted_commodities.map((c) => {
                        const info = COMMODITY_COLORS[c] ?? { bg: "#252838", fg: "#666", symbol: "?" };
                        return (
                          <span
                            key={c}
                            className="inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[8px] font-bold"
                            style={{ backgroundColor: info.bg, color: info.fg }}
                          >
                            {info.symbol}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sentiment.color }} />
                      <span className="text-[9px]" style={{ color: sentiment.color }}>{sentiment.label}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <p className="text-[11px] leading-relaxed text-gray-300">
                    {n.title}
                  </p>

                  {/* Time */}
                  <p className="mt-1.5 font-mono text-[9px] text-gray-700">
                    {new Date(n.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
