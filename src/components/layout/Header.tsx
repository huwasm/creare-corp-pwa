"use client";

import { useState } from "react";

const COMMODITIES = [
  { slug: "copper_lme", name: "Copper", symbol: "Cu", color: "#E87040" },
  { slug: "nickel_lme", name: "Nickel", symbol: "Ni", color: "#4CAF50" },
  { slug: "aluminium_lme", name: "Aluminium", symbol: "Al", color: "#2196F3" },
];

type Role = "trader" | "buyer";

export function Header({
  commodity,
  onCommodityChange,
  role,
  onRoleChange,
  regime,
  lastUpdated,
}: {
  commodity: string;
  onCommodityChange: (slug: string) => void;
  role: Role;
  onRoleChange: (role: Role) => void;
  regime?: string;
  lastUpdated?: string;
}) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2a2d3a] bg-[#0f1117]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3">
        {/* Left: Logo + Commodity Select */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Creare<span className="text-[#c9a44a]">Corp</span>
          </h1>

          <select
            value={commodity}
            onChange={(e) => onCommodityChange(e.target.value)}
            className="rounded-lg border border-[#3a3d4a] bg-[#252838] px-4 py-2 text-sm text-white outline-none focus:border-[#c9a44a] cursor-pointer"
          >
            {COMMODITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.symbol} — {c.name}
              </option>
            ))}
          </select>

          {regime && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                regime === "bullish"
                  ? "bg-green-500/15 text-green-400"
                  : regime === "bearish"
                    ? "bg-red-500/15 text-red-400"
                    : regime === "volatile"
                      ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-gray-500/15 text-gray-400"
              }`}
            >
              {regime}
            </span>
          )}
        </div>

        {/* Right: Role Toggle + Timestamp */}
        <div className="flex items-center gap-4">
          <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
            <button
              onClick={() => onRoleChange("trader")}
              className={`px-5 py-2 text-sm transition-colors cursor-pointer ${
                role === "trader"
                  ? "bg-[#c9a44a] font-semibold text-[#0f1117]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Trader
            </button>
            <button
              onClick={() => onRoleChange("buyer")}
              className={`px-5 py-2 text-sm transition-colors cursor-pointer ${
                role === "buyer"
                  ? "bg-[#c9a44a] font-semibold text-[#0f1117]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Buyer
            </button>
          </div>

          {lastUpdated && (
            <span className="text-xs text-gray-600">
              Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
