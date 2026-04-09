"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { CommodityCards } from "@/components/dashboard/CommodityCards";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { OverlayChart } from "@/components/dashboard/OverlayChart";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCommodities,
  fetchAllLatestPrices,
  fetchPrices,
  fetchNews,
  type Commodity,
  type PriceRow,
  type NewsRow,
} from "@/lib/queries";

type ViewMode = "cards" | "chart" | "overlay";

export default function ChartsPage() {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [activeCommodity, setActiveCommodity] = useState("copper_lme");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [role, setRole] = useState<"trader" | "buyer">("trader");
  const [priceData, setPriceData] = useState<Record<string, PriceRow[]>>({});
  const [fullPriceData, setFullPriceData] = useState<Record<string, PriceRow[]>>({});
  const [chartPrices, setChartPrices] = useState<PriceRow[]>([]);
  const [news, setNews] = useState<NewsRow[]>([]);
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  const supabase = createClient();

  // Initial load — 90d for cards
  useEffect(() => {
    async function load() {
      const [comms, allPrices, articles] = await Promise.all([
        fetchCommodities(supabase),
        fetchAllLatestPrices(supabase, 90),
        fetchNews(supabase, null, 30),
      ]);

      setCommodities(comms);
      setNews(articles);

      const grouped: Record<string, PriceRow[]> = {};
      allPrices.forEach((p) => {
        if (!grouped[p.commodity_slug]) grouped[p.commodity_slug] = [];
        grouped[p.commodity_slug].push(p);
      });
      setPriceData(grouped);
      setLoading(false);
    }
    load();
  }, []);

  // Load single commodity full history for chart view
  useEffect(() => {
    if (viewMode === "chart") {
      fetchPrices(supabase, activeCommodity, 9999).then(setChartPrices);
    }
  }, [viewMode, activeCommodity]);

  // Load ALL commodities full history for overlay view
  useEffect(() => {
    if (viewMode === "overlay" && Object.keys(fullPriceData).length === 0) {
      setLoadingOverlay(true);
      Promise.all(
        ["copper_lme", "nickel_lme", "aluminium_lme"].map((slug) =>
          fetchPrices(supabase, slug, 9999).then((prices) => ({ slug, prices }))
        )
      ).then((results) => {
        const grouped: Record<string, PriceRow[]> = {};
        results.forEach((r) => (grouped[r.slug] = r.prices));
        setFullPriceData(grouped);
        setLoadingOverlay(false);
      });
    }
  }, [viewMode]);

  // Load filtered news
  useEffect(() => {
    fetchNews(supabase, newsFilter, 30).then(setNews);
  }, [newsFilter]);

  const activeComm = commodities.find((c) => c.slug === activeCommodity);

  function handleCardSelect(slug: string) {
    setActiveCommodity(slug);
    setViewMode("chart");
  }

  if (loading) {
    return (
      <>
        <Header commodity={activeCommodity} onCommodityChange={setActiveCommodity} role={role} onRoleChange={setRole} />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-sm text-gray-600">Loading...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        commodity={activeCommodity}
        onCommodityChange={(slug) => {
          setActiveCommodity(slug);
          if (viewMode === "chart") {
            fetchPrices(supabase, slug, 9999).then(setChartPrices);
          }
        }}
        role={role}
        onRoleChange={setRole}
      />

      <main className="flex-1 px-5 py-6">
        <div className="mx-auto max-w-[1400px] space-y-5">
          {/* Welcome bar + view toggle */}
          <div className="flex items-center justify-between rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28] px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Welcome Back! What&apos;s your goal today?
              </h2>
              <p className="mt-0.5 text-xs text-gray-600">
                LME Metals Monitor — {new Date().toLocaleDateString("en-GB")}
              </p>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  viewMode === "cards" ? "bg-[#c9a44a] font-semibold text-[#0f1117]" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                ▦ Overview
              </button>
              <button
                onClick={() => setViewMode("chart")}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  viewMode === "chart" ? "bg-[#c9a44a] font-semibold text-[#0f1117]" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                📈 Single
              </button>
              <button
                onClick={() => setViewMode("overlay")}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  viewMode === "overlay" ? "bg-[#c9a44a] font-semibold text-[#0f1117]" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                📊 Compare
              </button>
            </div>
          </div>

          {/* Cards View */}
          {viewMode === "cards" && (
            <CommodityCards
              commodities={commodities}
              priceData={priceData}
              activeCommodity={activeCommodity}
              onSelect={handleCardSelect}
            />
          )}

          {/* Single Chart View */}
          {viewMode === "chart" && activeComm && (
            <>
              <div className="flex gap-3">
                {commodities.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => setActiveCommodity(c.slug)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${
                      c.slug === activeCommodity
                        ? "border-[#c9a44a] bg-[#252838] text-white"
                        : "border-[#2a2d3a] text-gray-500 hover:border-[#3a3d4a] hover:text-gray-300"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color_hex }} />
                    {c.symbol} — {c.name}
                  </button>
                ))}
              </div>
              <PriceChart commodity={activeComm} prices={chartPrices} onClose={() => setViewMode("cards")} />
            </>
          )}

          {/* Overlay Chart View — All 3 commodities */}
          {viewMode === "overlay" && (
            loadingOverlay ? (
              <div className="flex h-[400px] items-center justify-center rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28]">
                <span className="text-sm text-gray-600">Loading all commodities...</span>
              </div>
            ) : (
              <OverlayChart
                commodities={commodities}
                allPrices={fullPriceData}
                onClose={() => setViewMode("cards")}
              />
            )
          )}

          {/* Event Feed */}
          <EventFeed news={news} commodityFilter={newsFilter} onFilterChange={setNewsFilter} />
        </div>
      </main>
    </>
  );
}
