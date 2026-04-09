/**
 * Import prices.csv and news.csv into Supabase
 * Run: npx tsx scripts/import-csv.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] || "").trim()));
    return row;
  });
}

async function importPrices() {
  console.log("📦 Importing prices...");
  const rows = parseCsv(
    resolve(__dirname, "../docs/pacemakerpreinfo/prices.csv")
  );
  console.log(`   Parsed ${rows.length} rows`);

  const records = rows.map((r) => ({
    date: r.date.split("T")[0],
    commodity_slug: r.commodity,
    price: parseFloat(r.price),
  }));

  // Batch insert in chunks of 1000
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { error } = await supabase.from("30100_prices").upsert(chunk, {
      onConflict: "date,commodity_slug",
    });
    if (error) {
      console.error(`   ❌ Batch ${i / BATCH + 1} failed:`, error.message);
      return;
    }
    inserted += chunk.length;
    process.stdout.write(`   ✅ ${inserted}/${records.length}\r`);
  }
  console.log(`\n   ✅ Prices done: ${inserted} rows`);
}

async function importNews() {
  console.log("📰 Importing news...");
  const rows = parseCsv(
    resolve(__dirname, "../docs/pacemakerpreinfo/news.csv")
  );
  console.log(`   Parsed ${rows.length} rows`);

  const records = rows.map((r) => ({
    date: r.date,
    title: r.title,
    url: r.url || null,
    summary: r.summary || null,
    impacted_commodities: r.impacted_commodity
      ? r.impacted_commodity
          .split(",")
          .map((c: string) => c.trim().toLowerCase())
          .filter(Boolean)
      : [],
  }));

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const { error } = await supabase.from("30200_news").insert(chunk);
    if (error) {
      console.error(`   ❌ Batch ${i / BATCH + 1} failed:`, error.message);
      console.error(`   Row sample:`, JSON.stringify(chunk[0]).slice(0, 200));
      return;
    }
    inserted += chunk.length;
    process.stdout.write(`   ✅ ${inserted}/${records.length}\r`);
  }
  console.log(`\n   ✅ News done: ${inserted} rows`);
}

async function main() {
  console.log("🚀 CSV Import — Creare Corp\n");

  // Verify connection
  const { data } = await supabase
    .from("30000_commodities")
    .select("slug")
    .limit(1);
  if (!data?.length) {
    console.error("❌ Cannot reach Supabase or commodities table is empty");
    console.error("   Run the migration SQL first!");
    process.exit(1);
  }
  console.log("✅ Supabase connected\n");

  await importPrices();
  console.log("");
  await importNews();

  console.log("\n🎉 Import complete!");
}

main().catch(console.error);
