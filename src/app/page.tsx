"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";

type Commodity = {
  slug: string;
  name: string;
  symbol: string;
  color_hex: string;
  description: string;
};

type PriceRow = {
  date: string;
  price: number;
};

export default function Home() {
  const [commodity, setCommodity] = useState("copper_lme");
  const [role, setRole] = useState<"trader" | "buyer">("trader");
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [latestPrice, setLatestPrice] = useState<PriceRow | null>(null);
  const [priceCount, setPriceCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);
  const [connected, setConnected] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Load commodities
      const { data: comms } = await supabase
        .from("30000_commodities")
        .select("slug, name, symbol, color_hex, description")
        .order("sort_order");
      if (comms) setCommodities(comms);

      // Check counts
      const { count: pc } = await supabase
        .from("30100_prices")
        .select("*", { count: "exact", head: true });
      if (pc) setPriceCount(pc);

      const { count: nc } = await supabase
        .from("30200_news")
        .select("*", { count: "exact", head: true });
      if (nc) setNewsCount(nc);

      setConnected(true);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadPrice() {
      const { data } = await supabase
        .from("30100_prices")
        .select("date, price")
        .eq("commodity_slug", commodity)
        .order("date", { ascending: false })
        .limit(1);
      if (data?.[0]) setLatestPrice(data[0]);
    }
    loadPrice();
  }, [commodity]);

  const currentComm = commodities.find((c) => c.slug === commodity);

  return (
    <>
      <Header
        commodity={commodity}
        onCommodityChange={setCommodity}
        role={role}
        onRoleChange={setRole}
        lastUpdated={latestPrice?.date}
      />

      <main className="flex-1 px-5 py-8">
        <div className="mx-auto max-w-[1400px] space-y-8">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-gray-500">
              Supabase {connected ? "Connected" : "Connecting..."}
            </span>
            {connected && (
              <span className="text-xs text-gray-700">
                {priceCount.toLocaleString()} prices ·{" "}
                {newsCount.toLocaleString()} articles
              </span>
            )}
          </div>

          {/* Current Commodity Card */}
          {currentComm && latestPrice && (
            <div className="rounded-2xl border border-[#2a2d3a] bg-[#1a1d28] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
                      style={{
                        backgroundColor: currentComm.color_hex + "20",
                        color: currentComm.color_hex,
                      }}
                    >
                      {currentComm.symbol}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {currentComm.name}
                      </h2>
                      <p className="text-xs text-gray-500">LME · USD/mt</p>
                    </div>
                  </div>
                  <p className="mt-3 max-w-xl text-sm text-gray-400">
                    {currentComm.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-3xl font-bold text-white">
                    $
                    {Number(latestPrice.price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {latestPrice.date}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Placeholder panels */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#2a2d3a] bg-[#1a1d28] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Signal Engine
              </h3>
              <p className="mt-2 text-xs text-gray-600">
                Price features, trend, volatility, momentum — coming next
              </p>
            </div>
            <div className="rounded-2xl border border-[#2a2d3a] bg-[#1a1d28] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Threat Ranking
              </h3>
              <p className="mt-2 text-xs text-gray-600">
                News-derived threats, sentiment, global risks — coming next
              </p>
            </div>
            <div className="rounded-2xl border border-[#2a2d3a] bg-[#1a1d28] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Decision Brief
              </h3>
              <p className="mt-2 text-xs text-gray-600">
                BUY / SELL / WAIT — Claude AI analysis — coming next
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
