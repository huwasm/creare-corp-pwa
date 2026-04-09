/**
 * Chat API — Claude + vector search on commodity news
 *
 * POST /api/chat
 * Body: { message, commodity_slug, selected_date?, history[] }
 * Returns: SSE stream of { type: 'text', content } events
 *
 * Flow:
 * 1. Embed user query via Gemini → vector
 * 2. Search match_news_chunks() for relevant articles
 * 3. Fetch recent prices for context
 * 4. Send structured prompt to Claude with RAG context
 * 5. Stream response back via SSE
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-embedding-2-preview";
const GEMINI_DIMS = 1536;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: GEMINI_DIMS,
      }),
    }
  );

  const data = await response.json();
  if (!data.embedding?.values) {
    throw new Error(`Gemini embed error: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.embedding.values;
}

export async function POST(req: NextRequest) {
  // Check OpenAI key
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not configured. Add it to .env.secret to enable chat." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { message, commodity_slug, selected_date, history } = body as {
    message: string;
    commodity_slug: string;
    selected_date?: string;
    history?: { role: string; content: string }[];
  };

  if (!message || !commodity_slug) {
    return Response.json({ error: "message and commodity_slug required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const commodityName = commodity_slug.replace("_lme", "").charAt(0).toUpperCase() + commodity_slug.replace("_lme", "").slice(1);
  const commodityShort = commodity_slug.replace("_lme", "");

  // 1. Embed the user query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(message);
  } catch {
    // Fallback: skip vector search if embedding fails
    queryEmbedding = [];
  }

  // 2. Vector search for relevant news
  let relevantNews: { chunk_text: string; news_date: string; similarity: number }[] = [];
  if (queryEmbedding.length > 0) {
    const { data } = await supabase.rpc("match_news_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 8,
      filter_commodity: commodityShort,
    });
    relevantNews = data ?? [];
  }

  // 3. Fetch recent prices (last 30 days)
  const { data: recentPrices } = await supabase
    .from("30100_prices")
    .select("date, price")
    .eq("commodity_slug", commodity_slug)
    .order("date", { ascending: false })
    .limit(30);

  // 4. If selected_date, fetch news around that date
  let dateNews: { title: string; summary: string; date: string }[] = [];
  if (selected_date) {
    const { data } = await supabase
      .from("30200_news")
      .select("title, summary, date")
      .contains("impacted_commodities", [commodityShort])
      .gte("date", selected_date)
      .lte("date", new Date(new Date(selected_date).getTime() + 86400000 * 2).toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(5);
    dateNews = data ?? [];
  }

  // 5. Build system prompt
  const priceContext = (recentPrices ?? [])
    .slice(0, 15)
    .map((p: { date: string; price: number }) => `${p.date}: $${Number(p.price).toLocaleString()}`)
    .join("\n");

  const newsContext = relevantNews
    .map((n, i) => `[${i + 1}] (${n.news_date}, relevance: ${(n.similarity * 100).toFixed(0)}%)\n${n.chunk_text}`)
    .join("\n\n");

  const dateContext = dateNews.length > 0
    ? `\nNews on ${selected_date}:\n${dateNews.map((n) => `- ${n.title}`).join("\n")}`
    : "";

  const systemPrompt = `You are a commodity market analyst specializing in LME metals (Copper, Nickel, Aluminium).
Current focus: ${commodityName} (${commodity_slug})
${selected_date ? `User is looking at date: ${selected_date}` : ""}

Recent prices (newest first):
${priceContext || "No price data available"}

Relevant news articles (from vector search):
${newsContext || "No matching articles found"}
${dateContext}

Instructions:
- Be concise and data-driven
- Reference specific prices and dates when relevant
- If asked about trends, cite the price data
- If asked about events, cite the news articles
- Indicate uncertainty when data is limited
- Keep responses under 200 words unless the user asks for detail`;

  // 6. Build messages
  const messages = [
    ...(history ?? []).slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  // 7. Call OpenAI streaming API
  const openaiResponse = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    return Response.json(
      { error: `OpenAI API error: ${openaiResponse.status} — ${errorText.slice(0, 200)}` },
      { status: 500 }
    );
  }

  // 8. Transform OpenAI SSE → our SSE format
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = openaiResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              const content = event.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "text", content })}\n\n`)
                );
              }
            } catch {
              // Skip malformed events
            }
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", content: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
