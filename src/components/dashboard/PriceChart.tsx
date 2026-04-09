"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { Commodity, PriceRow } from "@/lib/queries";
import { computeSignals } from "@/lib/queries";

type ChartType = "line" | "area" | "bar";

type Props = {
  commodity: Commodity;
  prices: PriceRow[];
  onClose: () => void;
};

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: 9999 },
];

export function PriceChart({ commodity, prices, onClose }: Props) {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [timeRange, setTimeRange] = useState(90);

  const filteredPrices =
    timeRange >= 9999
      ? prices
      : prices.slice(-timeRange);

  const signals = computeSignals(filteredPrices);

  const chartData = filteredPrices.map((p) => ({
    date: p.date,
    price: p.price,
    label:
      timeRange >= 365
        ? new Date(p.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : timeRange >= 90
          ? new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  // Show ~8 ticks on x-axis
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#c9a44a] bg-[#1a1d28]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2d3a] px-5 py-3.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[13px] font-bold"
              style={{ backgroundColor: commodity.color_hex + "20", color: commodity.color_hex }}
            >
              {commodity.symbol}
            </div>
            <span className="text-base font-semibold text-white">{commodity.name}</span>
          </div>
          <span className="font-mono text-2xl font-bold text-white">
            ${signals.latest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            className={`rounded-md px-2.5 py-1 text-[13px] font-semibold ${
              signals.changePct >= 0
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {signals.changePct >= 0 ? "+" : ""}
            {signals.changePct.toFixed(2)}%
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Chart type pills */}
          <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
            {(["line", "area", "bar"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  chartType === t
                    ? "bg-[#c9a44a] font-semibold text-[#0f1117]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Time range pills */}
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
      <div className="h-[360px] px-5 py-4">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={commodity.color_hex} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={commodity.color_hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2233" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} interval={tickInterval} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={60} />
              <Tooltip
                contentStyle={{ background: "#252838", border: "1px solid #3a3d4a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#888" }}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                }}
                formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Price"]}
              />
              <ReferenceLine y={signals.avg} stroke="#3a3d4a" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="price" stroke={commodity.color_hex} strokeWidth={2} fill="url(#areaGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          ) : chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1f2233" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} interval={tickInterval} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={60} />
              <Tooltip
                contentStyle={{ background: "#252838", border: "1px solid #3a3d4a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#888" }}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                }}
                formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Price"]}
              />
              <Bar dataKey="price" fill={commodity.color_hex} opacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1f2233" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} interval={tickInterval} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={60} />
              <Tooltip
                contentStyle={{ background: "#252838", border: "1px solid #3a3d4a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#888" }}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                }}
                formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Price"]}
              />
              <ReferenceLine y={signals.avg} stroke="#3a3d4a" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="price" stroke={commodity.color_hex} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats Row */}
      <div className="flex gap-6 border-t border-[#2a2d3a] bg-[#161822] px-5 py-3.5">
        <Stat label="Open" value={`$${signals.open.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label={`High`} value={`$${signals.high.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="up" />
        <Stat label={`Low`} value={`$${signals.low.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="down" />
        <Stat label="Change" value={`${signals.change >= 0 ? "+" : ""}$${signals.change.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${signals.changePct >= 0 ? "+" : ""}${signals.changePct.toFixed(2)}%)`} type={signals.changePct >= 0 ? "up" : "down"} />
        <Stat label="Avg" value={`$${signals.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="Volatility" value={`${signals.volatility30d.toFixed(1)}%`} type={signals.volatility30d > 20 ? "warn" : "neutral"} />
      </div>
    </div>
  );
}

function Stat({ label, value, type }: { label: string; value: string; type?: "up" | "down" | "warn" | "neutral" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">{label}</span>
      <span
        className={`font-mono text-[13px] font-semibold ${
          type === "up" ? "text-green-400" : type === "down" ? "text-red-400" : type === "warn" ? "text-yellow-400" : "text-gray-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
