-- ============================================
-- 30300: News article embeddings for RAG chat
-- ============================================
-- Vector search on commodity news articles
-- Using Gemini embedding-2-preview (1536 dimensions)
-- Pattern: signum 02501_bizcard_content_chunks
-- ============================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 30300: News chunks with embeddings
CREATE TABLE IF NOT EXISTS public."30300_news_chunks" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  news_id BIGINT NOT NULL REFERENCES public."30200_news"(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  token_count INT NOT NULL DEFAULT 0,
  embedding vector(1536) NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'gemini-embedding-2-preview',
  impacted_commodities TEXT[] NOT NULL DEFAULT '{}',
  news_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(news_id, chunk_index, embedding_model)
);

COMMENT ON TABLE public."30300_news_chunks" IS 'Vector embeddings of commodity news articles for RAG search. 1536-dim Gemini embeddings.';

-- Index for vector similarity search (cosine)
CREATE INDEX idx_30300_embedding ON public."30300_news_chunks"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for commodity + date filtering
CREATE INDEX idx_30300_commodities ON public."30300_news_chunks"
  USING GIN(impacted_commodities);
CREATE INDEX idx_30300_date ON public."30300_news_chunks"(news_date DESC);

-- Idempotent re-indexing index
CREATE INDEX idx_30300_content_hash ON public."30300_news_chunks"(content_hash);

-- RLS: Public read (no auth needed for hackathon)
ALTER TABLE public."30300_news_chunks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read news chunks" ON public."30300_news_chunks"
  FOR SELECT USING (true);

-- Service role can insert/update/delete (for embedding script)
CREATE POLICY "Service write news chunks" ON public."30300_news_chunks"
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- RPC: match_news_chunks — vector similarity search
-- ============================================
CREATE OR REPLACE FUNCTION match_news_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10,
  filter_commodity text DEFAULT NULL,
  filter_date_from date DEFAULT NULL,
  filter_date_to date DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  news_id bigint,
  chunk_text text,
  news_date date,
  impacted_commodities text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.news_id,
    c.chunk_text,
    c.news_date,
    c.impacted_commodities,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public."30300_news_chunks" c
  WHERE
    1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_commodity IS NULL OR filter_commodity = ANY(c.impacted_commodities))
    AND (filter_date_from IS NULL OR c.news_date >= filter_date_from)
    AND (filter_date_to IS NULL OR c.news_date <= filter_date_to)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
