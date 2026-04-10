/**
 * Briefing API — computes full Price + Sentiment + Decision briefing
 *
 * GET /api/briefing?commodity=copper_lme
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { computePriceBlock, computeSentimentBlock, computeDecision } from "@/lib/briefing-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("commodity") || "copper_lme";
  const supabase = getSupabase();

  const commodityShort = slug.replace("_lme", "");
  const commodityName = commodityShort.charAt(0).toUpperCase() + commodityShort.slice(1);

  // Fetch all prices (paginated)
  const allPrices: { date: string; price: number }[] = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data } = await supabase
      .from("30100_prices")
      .select("date, price")
      .eq("commodity_slug", slug)
      .order("date", { ascending: true })
      .range(from, from + 999);
    const rows = (data ?? []).map((r: { date: string; price: number }) => ({ date: r.date, price: Number(r.price) }));
    allPrices.push(...rows);
    done = rows.length < 1000;
    from += 1000;
  }

  const lastDate = allPrices.length > 0 ? allPrices[allPrices.length - 1].date : new Date().toISOString().split("T")[0];

  // Fetch 30-day news with FinBERT scores
  const thirtyDaysAgo = new Date(lastDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: newsData } = await supabase
    .from("30200_news")
    .select("title, url, date, finbert_label, finbert_positive, finbert_negative, finbert_neutral, finbert_sentiment_score")
    .contains("impacted_commodities", [commodityShort])
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .lte("date", lastDate)
    .order("date", { ascending: false })
    .limit(200);

  const articles = (newsData ?? []) as {
    title: string; url: string | null; date: string;
    finbert_label: string | null; finbert_positive: number | null;
    finbert_negative: number | null; finbert_neutral: number | null;
    finbert_sentiment_score: number | null;
  }[];

  // Compute blocks
  const priceBlock = computePriceBlock(allPrices);
  const sentimentBlock = computeSentimentBlock(articles, lastDate);
  const decision = computeDecision(priceBlock, sentimentBlock);

  return Response.json({
    commodity: slug,
    commodityName,
    analysisDate: lastDate,
    currentPrice: allPrices.length > 0 ? allPrices[allPrices.length - 1].price : 0,
    price: priceBlock,
    sentiment: sentimentBlock,
    decision,
  });
}
