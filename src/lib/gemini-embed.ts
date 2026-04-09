/**
 * Gemini Embedding Client
 *
 * Cherry-picked from signum/lib/gemini-embed.ts
 * Adapted for creareCorp commodity news embedding.
 *
 * Outputs 1536 dimensions via MRL (Matryoshka Representation Learning).
 * Uses Google's Gemini Embedding API with batch support (100 texts/call).
 */

const MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2-preview';
const DIMENSIONS = 1536;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_RETRIES = 3;
const BATCH_SIZE = 100;

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('GOOGLE_AI_API_KEY not configured — add it to .env.local');
  return key;
}

/**
 * Embed a single text string. Returns a 1536-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const [result] = await embedTexts([text]);
  return result;
}

/**
 * Embed multiple texts in batch. Gemini supports up to 100 texts per call.
 * Auto-splits larger batches with 100ms pause between calls.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = getApiKey();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const body = {
      requests: batch.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: DIMENSIONS,
      })),
    };

    const response = await fetchWithRetry(
      `${API_BASE}/models/${MODEL}:batchEmbedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error(`Gemini API error: ${JSON.stringify(data)}`);
    }

    allEmbeddings.push(...data.embeddings.map((e: { values: number[] }) => e.values));

    // Rate limit courtesy pause between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return allEmbeddings;
}

/**
 * Fetch with exponential backoff retry (429 + 5xx).
 */
async function fetchWithRetry(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const response = await fetch(url, init);

  if (response.ok) return response;

  if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
    const delay = Math.pow(2, attempt + 1) * 1000;
    console.warn(`[gemini-embed] ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, init, attempt + 1);
  }

  const errorText = await response.text();
  throw new Error(`Gemini API ${response.status}: ${errorText}`);
}

/** SHA-256 content hash for idempotent re-indexing */
export async function hashContent(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
