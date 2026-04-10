"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommodityCards } from "@/components/dashboard/CommodityCards";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { OverlayChart } from "@/components/dashboard/OverlayChart";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
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

const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 600;
const DEFAULT_CHAT_WIDTH = 380;

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
  const [dateClickCount, setDateClickCount] = useState(0); // Force re-fetch on same date
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const supabase = createClient();

  // Handle date selection — dateClickCount triggers re-fetch even on same date
  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setDateClickCount((c) => c + 1);
  }, []);

  // Resize handle logic
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = chatWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, startWidth + delta));
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [chatWidth]);

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
      {/* Header */}
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
                <Link
                  href={`/briefing?commodity=${activeCommodity}`}
                  className="px-3.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-300"
                >
                  🎯 Briefing
                </Link>
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
                  onDateSelect={handleDateSelect}
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
                  onDateSelect={handleDateSelect}
                />
              )
            )}

            {/* Event Feed */}
            <EventFeed news={news} commodityFilter={newsFilter} onFilterChange={setNewsFilter} />
          </div>
        </main>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className={`w-1.5 shrink-0 cursor-col-resize bg-[#2a2d3a] transition-colors hover:bg-[#c9a44a] ${
            isResizing ? "bg-[#c9a44a]" : ""
          }`}
        />

        {/* Column 3: Right panel — unified chat container */}
        <aside
          className="flex shrink-0 flex-col overflow-hidden bg-[#0f1117] p-5"
          style={{ width: chatWidth }}
        >
          <ChatPanel
            activeCommodity={activeCommodity}
            commodityName={activeComm?.name ?? ""}
            selectedDate={selectedDate}
            dateClickCount={dateClickCount}
          />
        </aside>
      </div>
    </div>
  );
}
