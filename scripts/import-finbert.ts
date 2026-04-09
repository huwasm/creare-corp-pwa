/**
 * Import FinBERT sentiment scores from CSV into 30200_news.
 *
 * Run: npx tsx scripts/import-finbert.ts
 *
 * Matches rows by title + date, updates only sentiment columns.
 * Idempotent — safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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

async function main() {
  console.log("🧠 FinBERT Sentiment Import — Creare Corp\n");

  // 1. Parse CSV
  const csvPath = resolve(__dirname, "../news_with_finbert_sentiment.csv");
  console.log("📄 Parsing CSV...");
  const csvRows = parseCsv(csvPath);
  console.log(`   ${csvRows.length} rows parsed\n`);

  // 2. Load all news IDs from DB (paginated) — build lookup by title
  console.log("📦 Loading news IDs from Supabase...");
  const idLookup = new Map<string, number>(); // key: "title|||date" → id
  const PAGE = 1000;
  let from = 0;
  let done = false;

  while (!done) {
    const { data } = await supabase
      .from("30200_news")
      .select("id, title, date")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    const rows = data ?? [];
    for (const r of rows) {
      // Normalize date for matching
      const dateStr = r.date.replace("T", " ").replace("+00:00", "").replace(".000000", "");
      const key = `${r.title}|||${dateStr}`;
      idLookup.set(key, r.id);
    }

    if (rows.length < PAGE) {
      done = true;
    } else {
      from += PAGE;
    }
  }
  console.log(`   ${idLookup.size} news rows loaded\n`);

  // 3. Match CSV rows to DB IDs and batch update
  console.log("🔄 Matching and updating...");
  let matched = 0;
  let notFound = 0;
  let updated = 0;
  const BATCH = 50;
  let batch: { id: number; finbert_positive: number; finbert_negative: number; finbert_neutral: number; finbert_sentiment_score: number; finbert_label: string }[] = [];

  for (const row of csvRows) {
    const csvDate = row.date?.trim();
    const csvTitle = row.title?.trim();

    if (!csvDate || !csvTitle) continue;

    const key = `${csvTitle}|||${csvDate}`;
    const newsId = idLookup.get(key);

    if (!newsId) {
      notFound++;
      continue;
    }

    matched++;

    batch.push({
      id: newsId,
      finbert_positive: parseFloat(row.finbert_positive) || 0,
      finbert_negative: parseFloat(row.finbert_negative) || 0,
      finbert_neutral: parseFloat(row.finbert_neutral) || 0,
      finbert_sentiment_score: parseFloat(row.finbert_sentiment_score) || 0,
      finbert_label: row.finbert_label || "neutral",
    });

    if (batch.length >= BATCH) {
      // Update each row individually (upsert by id)
      for (const item of batch) {
        const { error } = await supabase
          .from("30200_news")
          .update({
            finbert_positive: item.finbert_positive,
            finbert_negative: item.finbert_negative,
            finbert_neutral: item.finbert_neutral,
            finbert_sentiment_score: item.finbert_sentiment_score,
            finbert_label: item.finbert_label,
          })
          .eq("id", item.id);

        if (error) {
          console.error(`   ❌ Update failed for id ${item.id}:`, error.message);
        } else {
          updated++;
        }
      }

      process.stdout.write(`   ✅ ${updated}/${matched} updated\r`);
      batch = [];
    }
  }

  // Flush remaining
  for (const item of batch) {
    const { error } = await supabase
      .from("30200_news")
      .update({
        finbert_positive: item.finbert_positive,
        finbert_negative: item.finbert_negative,
        finbert_neutral: item.finbert_neutral,
        finbert_sentiment_score: item.finbert_sentiment_score,
        finbert_label: item.finbert_label,
      })
      .eq("id", item.id);

    if (!error) updated++;
  }

  console.log(`\n\n📊 Results:`);
  console.log(`   CSV rows: ${csvRows.length}`);
  console.log(`   Matched: ${matched}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Updated: ${updated}`);
  console.log(`\n🎉 FinBERT import complete!`);
}

main().catch(console.error);
