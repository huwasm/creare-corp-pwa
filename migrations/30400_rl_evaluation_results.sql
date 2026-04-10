-- ============================================================
-- 30400_rl_evaluation_results
-- RL agent evaluation output: sentiment, actions, portfolio
-- ============================================================

CREATE TABLE IF NOT EXISTS "30400_rl_evaluation_results" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date            timestamptz     NOT NULL,
  commodity_slug  text            NOT NULL
                    REFERENCES "30000_commodities"(slug),
  price           numeric         NOT NULL,
  news_summary    text,
  negative        numeric         NOT NULL,
  neutral         numeric         NOT NULL,
  positive        numeric         NOT NULL,
  sentiment_score numeric         NOT NULL,
  action          smallint        NOT NULL,   -- 0=hold, 1=buy, 2=sell
  greedy_action   smallint        NOT NULL,   -- 0=hold, 1=buy
  prob_hold       numeric         NOT NULL,
  prob_buy        numeric         NOT NULL,
  prob_sell       numeric         NOT NULL,
  entropy         numeric         NOT NULL,
  net_worth       numeric         NOT NULL,
  reward          numeric         NOT NULL,
  created_at      timestamptz     NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_30400_date        ON "30400_rl_evaluation_results" (date);
CREATE INDEX idx_30400_commodity   ON "30400_rl_evaluation_results" (commodity_slug);
CREATE INDEX idx_30400_date_comm   ON "30400_rl_evaluation_results" (commodity_slug, date);

-- RLS
ALTER TABLE "30400_rl_evaluation_results" ENABLE ROW LEVEL SECURITY;
