"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommodityCards } from "@/components/dashboard/CommodityCards";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { OverlayChart } from "@/components/dashboard/OverlayChart";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { DateEvents } from "@/components/dashboard/DateEvents";
import { TopHighlights } from "@/components/dashboard/TopHighlights";
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

  // 3-column layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const supabase = createClient();

  // Initial load
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

  // Load single commodity full history
  useEffect(() => {
    if (viewMode === "chart") {
      fetchPrices(supabase, activeCommodity, 9999).then(setChartPrices);
    }
  }, [viewMode, activeCommodity]);

  // Load all commodities for overlay
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

  function handleSidebarViewChange(view: string) {
    if (view === "overview") setViewMode("cards");
    else if (view === "charts") setViewMode("chart");
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <Header commodity={activeCommodity} onCommodityChange={setActiveCommodity} role={role} onRoleChange={setRole} />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-sm text-gray-600">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header — full width */}
      <Header
        commodity={activeCommodity}
        onCommodityChange={(slug) => {
          setActiveCommodity(slug);
          setSelectedDate(null);
          if (viewMode === "chart") {
            fetchPrices(supabase, slug, 9999).then(setChartPrices);
          }
        }}
        role={role}
        onRoleChange={setRole}
      />

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeView={viewMode === "cards" ? "overview" : viewMode === "chart" || viewMode === "overlay" ? "charts" : "overview"}
          onViewChange={handleSidebarViewChange}
        />

        {/* Column 2: Main content */}
        <main className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            {/* Welcome bar + view toggle */}
            <div className="flex items-center justify-between rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28] px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Welcome Back! What&apos;s your goal today?
                </h2>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  LME Metals Monitor — {new Date().toLocaleDateString("en-GB")}
                </p>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
                <button
                  onClick={() => { setViewMode("cards"); setSelectedDate(null); }}
                  className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "cards" ? "bg-[#c9a44a] font-semibold text-[#0f1117]" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  ▦ Overview
                </button>
                <button
                  onClick={() => setViewMode("chart")}
                  className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "chart" ? "bg-[#c9a44a] font-semibold text-[#0f1117]" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  📈 Single
                </button>
                <button
                  onClick={() => setViewMode("overlay")}
                  className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
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
                <div className="flex gap-2">
                  {commodities.map((c) => (
                    <button
                      key={c.slug}
                      onClick={() => { setActiveCommodity(c.slug); setSelectedDate(null); }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
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
                <PriceChart
                  commodity={activeComm}
                  prices={chartPrices}
                  onClose={() => { setViewMode("cards"); setSelectedDate(null); }}
                  onDateSelect={setSelectedDate}
                />
              </>
            )}

            {/* Overlay Chart View */}
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

        {/* Column 3: Right panel — highlights + date events + chat */}
        <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-[#2a2d3a] bg-[#0f1117]">
          {/* Top: Highlights or Date Events */}
          <div className="flex-1 overflow-y-auto">
            {selectedDate ? (
              <DateEvents
                selectedDate={selectedDate}
                activeCommodity={activeCommodity}
                commodityName={activeComm?.name ?? ""}
              />
            ) : (
              <TopHighlights activeCommodity={activeCommodity} />
            )}
          </div>

          {/* Bottom: Chat */}
          <div className="h-[200px] shrink-0 border-t border-[#2a2d3a] flex flex-col">
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-white">Chat</h3>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4">
              <p className="text-[10px] text-gray-700 italic">Ask about commodity prices, trends, or news...</p>
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-[#1f2233] px-3 py-2">
              <input
                type="text"
                placeholder="Ask about this commodity..."
                disabled
                className="flex-1 rounded-lg border border-[#3a3d4a] bg-[#252838] px-3 py-1.5 text-xs text-gray-500 outline-none placeholder:text-gray-700"
              />
              <button
                disabled
                className="rounded-lg bg-[#252838] px-2.5 py-1.5 text-xs text-gray-600"
              >
                ↑
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
