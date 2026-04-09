-- ============================================
-- Add FinBERT sentiment columns to 30200_news
-- ============================================
-- Pre-computed by FinBERT ML model, stored for fast access.
-- No Python needed at runtime — all scores cached in DB.
-- ============================================

ALTER TABLE public."30200_news"
  ADD COLUMN IF NOT EXISTS finbert_positive NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS finbert_negative NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS finbert_neutral NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS finbert_sentiment_score NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS finbert_label TEXT;

COMMENT ON COLUMN public."30200_news".finbert_positive IS 'FinBERT positive probability (0-1)';
COMMENT ON COLUMN public."30200_news".finbert_negative IS 'FinBERT negative probability (0-1)';
COMMENT ON COLUMN public."30200_news".finbert_neutral IS 'FinBERT neutral probability (0-1)';
COMMENT ON COLUMN public."30200_news".finbert_sentiment_score IS 'FinBERT signed score: +confidence (positive), -confidence (negative), 0 (neutral)';
COMMENT ON COLUMN public."30200_news".finbert_label IS 'FinBERT label: positive, negative, or neutral';

-- Index for filtering by sentiment
CREATE INDEX IF NOT EXISTS idx_30200_finbert_label ON public."30200_news"(finbert_label);
CREATE INDEX IF NOT EXISTS idx_30200_finbert_score ON public."30200_news"(finbert_sentiment_score);
