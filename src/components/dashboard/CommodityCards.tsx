"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
} from "recharts";
import type { Commodity, PriceRow } from "@/lib/queries";
import { computeSignals, getStatusBadge } from "@/lib/queries";

type Props = {
  commodities: Commodity[];
  priceData: Record<string, PriceRow[]>;
  activeCommodity: string;
  onSelect: (slug: string) => void;
};

export function CommodityCards({ commodities, priceData, activeCommodity, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {commodities.map((c) => {
        const prices = priceData[c.slug] ?? [];
        const signals = computeSignals(prices);
        const status = getStatusBadge(signals.trend14d, signals.volatility30d);
        const isActive = c.slug === activeCommodity;
        const chartData = prices.map((p) => ({ price: p.price }));

        return (
          <div
            key={c.slug}
            onClick={() => onSelect(c.slug)}
            className={`cursor-pointer rounded-[14px] border bg-[#1a1d28] p-5 transition-all hover:-translate-y-0.5 hover:border-[#3a3d4a] ${
              isActive
                ? "border-[#c9a44a] shadow-[0_0_0_1px_rgba(201,164,74,0.2)]"
                : "border-[#2a2d3a]"
            }`}
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg font-mono text-sm font-bold"
                  style={{ backgroundColor: c.color_hex + "20", color: c.color_hex }}
                >
                  {c.symbol}
                </div>
                <span className="text-[15px] font-semibold text-white">{c.name}</span>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  status.type === "buy"
                    ? "border-green-500/30 bg-green-500/15 text-green-400"
                    : status.type === "sell"
                      ? "border-red-500/30 bg-red-500/15 text-red-400"
                      : "border-yellow-500/30 bg-yellow-500/15 text-yellow-400"
                }`}
              >
                {status.label}
              </span>
            </div>

            {/* Price */}
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[11px] text-gray-600">LME Price</span>
              <span className="font-mono text-base font-bold text-white">
                {signals.latest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="ml-1 text-[11px] text-gray-600">$/MT</span>
                <svg
                  className={`ml-1 inline-block ${signals.changePct >= 0 ? "text-green-400" : "text-red-400"}`}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: signals.changePct >= 0 ? "rotate(-45deg)" : "rotate(45deg)" }}
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>

            {/* Sparkline */}
            <div className="my-3 h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${c.slug}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color_hex} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={c.color_hex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={["dataMin", "dataMax"]} hide />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={c.color_hex}
                    strokeWidth={1.5}
                    fill={`url(#grad-${c.slug})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Signals */}
            <div className="rounded-[10px] bg-[#161822] p-3">
              <SignalRow label="14 day trend" value={`${signals.trend14d >= 0 ? "+" : ""}${signals.trend14d.toFixed(1)} %`} type={signals.trend14d >= 0 ? "up" : "down"} />
              <SignalRow label="Volatility" value={`${signals.volatility30d.toFixed(1)} % (30d)`} type="neutral" />
              <SignalRow label="High" value={`$${signals.high.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="up" last />
            </div>

            {/* Button */}
            <button className="mt-3.5 w-full rounded-[10px] border border-[#3a3d4a] bg-[#252838] py-2.5 text-xs font-semibold text-gray-300 transition-colors hover:border-[#c9a44a] hover:bg-[#c9a44a] hover:text-[#0f1117]">
              View forecast →
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SignalRow({ label, value, type, last }: { label: string; value: string; type: "up" | "down" | "neutral"; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${last ? "" : "border-b border-[#1f2233]"}`}>
      <span className="text-[11px] text-gray-500">{label}</span>
      <span
        className={`font-mono text-xs font-semibold ${
          type === "up" ? "text-green-400" : type === "down" ? "text-red-400" : "text-gray-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
