/**
 * Forecast API — ARIMA price prediction
 *
 * POST /api/forecast
 * Body: { commodity_slug, horizon_days, lookback_days? }
 * Returns: forecast points with confidence intervals
 */

import { createClient } from "@supabase/supabase-js";
import { computeForecast } from "@/lib/forecast";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      commodity_slug,
      horizon_days = 7,
      lookback_days = 90,
    } = body as {
      commodity_slug: string;
      horizon_days?: number;
      lookback_days?: number;
    };

    if (!commodity_slug) {
      return Response.json({ error: "commodity_slug required" }, { status: 400 });
    }

    if (![7, 14, 21, 30].includes(horizon_days)) {
      return Response.json({ error: "horizon_days must be 7, 14, 21, or 30" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch prices — paginate to get all data
    const allPrices: { date: string; price: number }[] = [];
    const PAGE = 1000;
    let from = 0;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from("30100_prices")
        .select("date, price")
        .eq("commodity_slug", commodity_slug)
        .order("date", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`Supabase error: ${error.message}`);
      const rows = data ?? [];
      allPrices.push(...rows.map((r: { date: string; price: number }) => ({ date: r.date, price: Number(r.price) })));

      if (rows.length < PAGE) {
        done = true;
      } else {
        from += PAGE;
      }
    }

    if (allPrices.length < 10) {
      return Response.json(
        { error: `Not enough data for ${commodity_slug} (${allPrices.length} rows)` },
        { status: 400 }
      );
    }

    // Run ARIMA forecast
    const result = computeForecast(allPrices, horizon_days, lookback_days);
    result.commodity = commodity_slug;

    return Response.json(result);
  } catch (err) {
    console.error("[forecast]", err);
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
