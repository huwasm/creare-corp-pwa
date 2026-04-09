/**
 * Embed all news articles into 30300_news_chunks for RAG search.
 *
 * Run: npx tsx scripts/embed-news.ts
 *
 * Processes 29,009 articles in batches of 100 via Gemini embedding API.
 * Idempotent — skips articles that already have embeddings (by content_hash).
 * Cost: $0 (Gemini embeddings are free)
 * Time: ~2-5 minutes
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_KEY = process.env.GOOGLE_AI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!GOOGLE_KEY) {
  console.error("❌ Missing GOOGLE_AI_API_KEY — add it to .env.local or .env.secret");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MODEL = "gemini-embedding-2-preview";
const DIMENSIONS = 1536;
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBED_BATCH = 100; // Gemini max per call
const DB_BATCH = 50; // Insert batch size for Supabase
const MAX_RETRIES = 3;

type NewsRow = {
  id: number;
  date: string;
  title: string;
  summary: string | null;
  impacted_commodities: string[];
};

async function hashContent(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 0
): Promise<Response> {
  const response = await fetch(url, init);
  if (response.ok) return response;

  if (
    (response.status === 429 || response.status >= 500) &&
    attempt < MAX_RETRIES
  ) {
    const delay = Math.pow(2, attempt + 1) * 1000;
    console.warn(
      `   ⚠ ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms`
    );
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, init, attempt + 1);
  }

  const errorText = await response.text();
  throw new Error(`Gemini API ${response.status}: ${errorText}`);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const body = {
    requests: texts.map((text) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: DIMENSIONS,
    })),
  };

  const response = await fetchWithRetry(
    `${API_BASE}/models/${MODEL}:batchEmbedContents?key=${GOOGLE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error(`Gemini API error: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return data.embeddings.map((e: { values: number[] }) => e.values);
}

async function fetchAllNews(): Promise<NewsRow[]> {
  const allRows: NewsRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from("30200_news")
      .select("id, date, title, summary, impacted_commodities")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Fetch failed: ${error.message}`);
    const rows = (data ?? []) as NewsRow[];
    allRows.push(...rows);

    if (rows.length < PAGE) {
      done = true;
    } else {
      from += PAGE;
    }
  }

  return allRows;
}

async function getExistingHashes(): Promise<Set<string>> {
  const hashes = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  let done = false;

  while (!done) {
    const { data } = await supabase
      .from("30300_news_chunks")
      .select("content_hash")
      .range(from, from + PAGE - 1);

    const rows = data ?? [];
    rows.forEach((r: { content_hash: string }) => hashes.add(r.content_hash));

    if (rows.length < PAGE) {
      done = true;
    } else {
      from += PAGE;
    }
  }

  return hashes;
}

async function main() {
  console.log("🚀 News Embedding Pipeline — Creare Corp\n");

  // 1. Fetch all news
  console.log("📰 Fetching news articles...");
  const allNews = await fetchAllNews();
  console.log(`   ${allNews.length} articles loaded\n`);

  // 2. Check existing embeddings (for idempotent re-runs)
  console.log("🔍 Checking existing embeddings...");
  const existingHashes = await getExistingHashes();
  console.log(`   ${existingHashes.size} already embedded\n`);

  // 3. Prepare texts and filter already-embedded
  const toEmbed: {
    news: NewsRow;
    text: string;
    hash: string;
    tokenCount: number;
  }[] = [];

  for (const n of allNews) {
    const text = [
      n.title,
      n.summary ?? "",
      `Commodities: ${n.impacted_commodities.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const hash = await hashContent(`${n.id}:0:${text}`);

    if (!existingHashes.has(hash)) {
      toEmbed.push({
        news: n,
        text,
        hash,
        tokenCount: Math.ceil(text.length / 4),
      });
    }
  }

  console.log(`📊 ${toEmbed.length} articles to embed (${allNews.length - toEmbed.length} skipped)\n`);

  if (toEmbed.length === 0) {
    console.log("✅ All articles already embedded. Nothing to do.");
    return;
  }

  // 4. Embed in batches of 100
  let embedded = 0;
  let insertBuffer: Record<string, unknown>[] = [];

  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH);
    const texts = batch.map((b) => b.text);

    try {
      const embeddings = await embedBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        const { news, hash, tokenCount } = batch[j];
        insertBuffer.push({
          news_id: news.id,
          chunk_text: batch[j].text,
          chunk_index: 0,
          token_count: tokenCount,
          embedding: embeddings[j],
          content_hash: hash,
          embedding_model: MODEL,
          impacted_commodities: news.impacted_commodities,
          news_date: news.date.split("T")[0],
        });
      }

      embedded += batch.length;

      // Flush insert buffer every DB_BATCH records
      while (insertBuffer.length >= DB_BATCH) {
        const toInsert = insertBuffer.splice(0, DB_BATCH);
        const { error } = await supabase
          .from("30300_news_chunks")
          .insert(toInsert);
        if (error) {
          console.error(`   ❌ Insert failed:`, error.message);
          console.error(`   First record:`, JSON.stringify(toInsert[0]).slice(0, 200));
          return;
        }
      }

      process.stdout.write(
        `   ✅ ${embedded}/${toEmbed.length} embedded (${((embedded / toEmbed.length) * 100).toFixed(1)}%)\r`
      );

      // Free tier: 100 requests/min. Wait 35s between batches to stay safe.
      if (i + EMBED_BATCH < toEmbed.length) {
        const waitSec = 35;
        const remaining = toEmbed.length - embedded;
        const eta = Math.ceil((remaining / EMBED_BATCH) * waitSec / 60);
        process.stdout.write(`\n   ⏳ Waiting ${waitSec}s for rate limit (ETA: ~${eta} min)...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      }
    } catch (err) {
      console.error(`\n   ❌ Batch ${i / EMBED_BATCH + 1} failed:`, err);
      // Try to flush what we have
      break;
    }
  }

  // Flush remaining
  if (insertBuffer.length > 0) {
    const { error } = await supabase
      .from("30300_news_chunks")
      .insert(insertBuffer);
    if (error) {
      console.error(`   ❌ Final flush failed:`, error.message);
    }
  }

  console.log(`\n\n🎉 Embedding complete! ${embedded} articles embedded.`);

  // 5. Verify
  const { count } = await supabase
    .from("30300_news_chunks")
    .select("*", { count: "exact", head: true });
  console.log(`📊 Total chunks in DB: ${count}`);
}

main().catch(console.error);
