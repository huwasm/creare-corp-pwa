"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { Commodity, PriceRow } from "@/lib/queries";

const TIME_RANGES = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: 9999 },
];

type ViewMode = "price" | "percent";

type Props = {
  commodities: Commodity[];
  allPrices: Record<string, PriceRow[]>;
  onClose: () => void;
  onDateSelect?: (date: string) => void;
};

export function OverlayChart({ commodities, allPrices, onClose, onDateSelect }: Props) {
  const [timeRange, setTimeRange] = useState(90);
  const [viewMode, setViewMode] = useState<ViewMode>("percent");

  // Build merged dataset by date
  const allDates = new Set<string>();
  const pricesBySlug: Record<string, Record<string, number>> = {};

  for (const c of commodities) {
    const prices = allPrices[c.slug] ?? [];
    const filtered = timeRange >= 9999 ? prices : prices.slice(Math.max(0, prices.length - timeRange));
    pricesBySlug[c.slug] = {};
    for (const p of filtered) {
      allDates.add(p.date);
      pricesBySlug[c.slug][p.date] = p.price;
    }
  }

  const sortedDates = Array.from(allDates).sort();

  // Get base prices for % normalization (first date for each commodity)
  const basePrices: Record<string, number> = {};
  for (const c of commodities) {
    for (const d of sortedDates) {
      if (pricesBySlug[c.slug]?.[d]) {
        basePrices[c.slug] = pricesBySlug[c.slug][d];
        break;
      }
    }
  }

  const chartData = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = {
      date,
      label:
        timeRange >= 365
          ? new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };

    for (const c of commodities) {
      const price = pricesBySlug[c.slug]?.[date];
      if (price != null) {
        if (viewMode === "percent") {
          const base = basePrices[c.slug];
          row[c.slug] = base ? parseFloat((((price - base) / base) * 100).toFixed(2)) : 0;
        } else {
          row[c.slug] = price;
        }
      } else {
        row[c.slug] = null;
      }
    }

    return row;
  });

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  // Compute current % changes for header
  const changes = commodities.map((c) => {
    const prices = allPrices[c.slug] ?? [];
    const filtered = timeRange >= 9999 ? prices : prices.slice(Math.max(0, prices.length - timeRange));
    if (filtered.length < 2) return { slug: c.slug, pct: 0, latest: 0 };
    const first = filtered[0].price;
    const last = filtered[filtered.length - 1].price;
    return { slug: c.slug, pct: ((last - first) / first) * 100, latest: last };
  });

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#c9a44a] bg-[#1a1d28]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2d3a] px-5 py-3.5">
        <div className="flex items-center gap-4">
          <span className="text-base font-semibold text-white">All Commodities</span>
          <span className="text-xs text-gray-500">
            {viewMode === "percent" ? "Normalized % change" : "Absolute price USD/mt"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Price vs % toggle */}
          <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
            <button
              onClick={() => setViewMode("percent")}
              className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "percent"
                  ? "bg-[#c9a44a] font-semibold text-[#0f1117]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              %
            </button>
            <button
              onClick={() => setViewMode("price")}
              className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "price"
                  ? "bg-[#c9a44a] font-semibold text-[#0f1117]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              $
            </button>
          </div>

          {/* Time range */}
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setTimeRange(r.days)}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  timeRange === r.days
                    ? "border-[#4a4d5a] bg-[#2a2d3a] text-white"
                    : "border-[#3a3d4a] text-gray-600 hover:border-[#4a4d5a] hover:text-gray-400"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3a3d4a] text-gray-500 transition-colors hover:border-red-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px] px-5 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} onClick={(e: Record<string, unknown>) => { const p = (e?.activePayload as Array<{ payload: { date: string } }>) ?? []; if (p[0]?.payload?.date) onDateSelect?.(p[0].payload.date); }} style={{ cursor: "crosshair" }}>
            <CartesianGrid stroke="#1f2233" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#444", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fill: "#444", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={65}
              tickFormatter={(v) =>
                viewMode === "percent"
                  ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`
                  : `$${(v / 1000).toFixed(1)}k`
              }
            />
            <Tooltip
              contentStyle={{
                background: "#252838",
                border: "1px solid #3a3d4a",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#888" }}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload?.date;
                return d
                  ? new Date(d).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "";
              }}
              formatter={(v, name) => {
                const c = commodities.find((c) => c.slug === name);
                const label = c ? `${c.symbol} ${c.name}` : String(name);
                if (viewMode === "percent") {
                  return [`${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`, label];
                }
                return [
                  `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                  label,
                ];
              }}
            />
            {viewMode === "percent" && (
              <Line
                dataKey={() => 0}
                stroke="#3a3d4a"
                strokeDasharray="4 4"
                strokeWidth={1}
                dot={false}
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {commodities.map((c) => (
              <Line
                key={c.slug}
                type="monotone"
                dataKey={c.slug}
                stroke={c.color_hex}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + Stats */}
      <div className="flex items-center justify-between border-t border-[#2a2d3a] bg-[#161822] px-5 py-3.5">
        <div className="flex gap-5">
          {commodities.map((c) => {
            const info = changes.find((ch) => ch.slug === c.slug);
            return (
              <div key={c.slug} className="flex items-center gap-2">
                <span className="h-[3px] w-3 rounded" style={{ backgroundColor: c.color_hex }} />
                <span className="text-xs text-gray-400">
                  {c.symbol} {c.name}
                </span>
                <span className="font-mono text-xs text-gray-300">
                  ${info?.latest?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span
                  className={`font-mono text-xs font-semibold ${
                    (info?.pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {(info?.pct ?? 0) >= 0 ? "+" : ""}
                  {info?.pct?.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-600">
          {chartData.length} data points · {viewMode === "percent" ? "% change from start" : "USD/mt"}
        </div>
      </div>
    </div>
  );
}
