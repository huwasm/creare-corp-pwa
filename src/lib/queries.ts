import { SupabaseClient } from "@supabase/supabase-js";

export type Commodity = {
  slug: string;
  name: string;
  symbol: string;
  color_hex: string;
  description: string;
  typical_range_low: number;
  typical_range_high: number;
  key_producers: string[];
  key_consumers: string[];
  primary_use: string;
};

export type PriceRow = {
  date: string;
  commodity_slug: string;
  price: number;
};

export type NewsRow = {
  id: number;
  date: string;
  title: string;
  url: string | null;
  summary: string | null;
  impacted_commodities: string[];
};

export async function fetchCommodities(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("30000_commodities")
    .select("slug, name, symbol, color_hex, description, typical_range_low, typical_range_high, key_producers, key_consumers, primary_use")
    .order("sort_order");
  return (data ?? []) as Commodity[];
}

export async function fetchPrices(
  supabase: SupabaseClient,
  slug: string,
  days: number
) {
  let query = supabase
    .from("30100_prices")
    .select("date, commodity_slug, price")
    .eq("commodity_slug", slug)
    .order("date", { ascending: true })
    .limit(2000);

  if (days < 9999) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("date", since.toISOString().split("T")[0]);
  }

  const { data } = await query;
  return (data ?? []) as PriceRow[];
}

export async function fetchAllLatestPrices(supabase: SupabaseClient, days: number) {
  let query = supabase
    .from("30100_prices")
    .select("date, commodity_slug, price")
    .order("date", { ascending: true })
    .limit(5000);

  if (days < 9999) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("date", since.toISOString().split("T")[0]);
  }

  const { data } = await query;

  return (data ?? []) as PriceRow[];
}

export async function fetchNews(
  supabase: SupabaseClient,
  commodity: string | null,
  limit: number = 20
) {
  let query = supabase
    .from("30200_news")
    .select("id, date, title, url, summary, impacted_commodities")
    .order("date", { ascending: false })
    .limit(limit);

  if (commodity) {
    query = query.contains("impacted_commodities", [commodity.replace("_lme", "")]);
  }

  const { data } = await query;
  return (data ?? []) as NewsRow[];
}

// Signal computations from price data
export function computeSignals(prices: PriceRow[]) {
  if (prices.length < 2) {
    return { trend14d: 0, volatility30d: 0, change: 0, changePct: 0, high: 0, low: 0, avg: 0, latest: 0, open: 0 };
  }

  const latest = prices[prices.length - 1].price;
  const open = prices[0].price;
  const change = latest - open;
  const changePct = (change / open) * 100;

  const allPrices = prices.map((p) => p.price);
  const high = Math.max(...allPrices);
  const low = Math.min(...allPrices);
  const avg = allPrices.reduce((s, p) => s + p, 0) / allPrices.length;

  // 14-day trend
  const last14 = prices.slice(-14);
  const trend14d =
    last14.length >= 2
      ? ((last14[last14.length - 1].price - last14[0].price) / last14[0].price) * 100
      : 0;

  // 30-day volatility (coefficient of variation)
  const last30 = prices.slice(-30).map((p) => p.price);
  const mean30 = last30.reduce((s, p) => s + p, 0) / last30.length;
  const std30 = Math.sqrt(
    last30.reduce((s, p) => s + (p - mean30) ** 2, 0) / last30.length
  );
  const volatility30d = (std30 / mean30) * 100;

  return { trend14d, volatility30d, change, changePct, high, low, avg, latest, open };
}

export function getStatusBadge(trend14d: number, volatility30d: number): { label: string; type: "buy" | "wait" | "sell" } {
  if (trend14d > 3 && volatility30d < 25) return { label: "Buying Zone", type: "buy" };
  if (trend14d < -3) return { label: "Bearish", type: "sell" };
  return { label: "Wait!", type: "wait" };
}
