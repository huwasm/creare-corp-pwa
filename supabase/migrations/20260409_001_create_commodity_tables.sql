-- ============================================
-- Commodity Signal Intelligence — Core Tables
-- ============================================
-- Naming: 30xxx range for commodity/metals vertical
-- All prices in USD per metric ton (LME)
-- No auth required — public read access
-- ============================================

-- 30000: Commodity product profiles
CREATE TABLE IF NOT EXISTS public."30000_commodities" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'LME',
  unit TEXT NOT NULL DEFAULT 'USD/mt',
  category TEXT NOT NULL DEFAULT 'base_metal',
  description TEXT,
  typical_range_low NUMERIC(12,2),
  typical_range_high NUMERIC(12,2),
  key_producers TEXT[] DEFAULT '{}',
  key_consumers TEXT[] DEFAULT '{}',
  primary_use TEXT,
  color_hex TEXT NOT NULL DEFAULT '#888888',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public."30000_commodities" IS 'Commodity product profiles for LME metals tracking.';

INSERT INTO public."30000_commodities" (slug, name, symbol, exchange, unit, category, description, typical_range_low, typical_range_high, key_producers, key_consumers, primary_use, color_hex, sort_order) VALUES
  (
    'copper_lme', 'Copper', 'Cu', 'LME', 'USD/mt', 'base_metal',
    'Primary industrial metal used in electrical wiring, construction, and transport. Key indicator of global economic health.',
    5000, 12000,
    '{Chile,Peru,China,DRC,USA}',
    '{China,EU,USA,Japan,South Korea}',
    'Electrical wiring, construction, electronics, transport, renewable energy',
    '#E87040', 1
  ),
  (
    'nickel_lme', 'Nickel', 'Ni', 'LME', 'USD/mt', 'base_metal',
    'Essential input for stainless steel production and EV battery cathodes. Growing demand from energy transition.',
    10000, 25000,
    '{Indonesia,Philippines,Russia,New Caledonia,Australia}',
    '{China,EU,Japan,USA,South Korea}',
    'Stainless steel, EV batteries, alloys, plating, aerospace',
    '#4CAF50', 2
  ),
  (
    'aluminium_lme', 'Aluminium', 'Al', 'LME', 'USD/mt', 'base_metal',
    'Lightweight metal for transport, packaging, and construction. Energy-intensive production makes it sensitive to power costs.',
    1500, 3500,
    '{China,India,Russia,Canada,UAE}',
    '{China,EU,USA,Japan,Germany}',
    'Transport, packaging, construction, electrical, consumer goods',
    '#2196F3', 3
  )
ON CONFLICT (slug) DO NOTHING;

-- 30100: Daily prices
CREATE TABLE IF NOT EXISTS public."30100_prices" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  commodity_slug TEXT NOT NULL REFERENCES public."30000_commodities"(slug),
  price NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(date, commodity_slug)
);

COMMENT ON TABLE public."30100_prices" IS 'Daily LME commodity prices in USD per metric ton.';

CREATE INDEX idx_30100_commodity_date ON public."30100_prices"(commodity_slug, date DESC);
CREATE INDEX idx_30100_date ON public."30100_prices"(date DESC);

-- 30200: News articles
CREATE TABLE IF NOT EXISTS public."30200_news" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  impacted_commodities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public."30200_news" IS 'GDELT commodity news articles with impact tags.';

CREATE INDEX idx_30200_date ON public."30200_news"(date DESC);
CREATE INDEX idx_30200_commodities ON public."30200_news" USING GIN(impacted_commodities);

-- ============================================
-- RLS: Public read, no auth needed
-- ============================================
ALTER TABLE public."30000_commodities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."30100_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."30200_news" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read commodities" ON public."30000_commodities"
  FOR SELECT USING (true);

CREATE POLICY "Public read prices" ON public."30100_prices"
  FOR SELECT USING (true);

CREATE POLICY "Public read news" ON public."30200_news"
  FOR SELECT USING (true);
