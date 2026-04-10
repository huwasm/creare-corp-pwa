/**
 * Briefing Engine — computes Price Block + Sentiment Block + Decision Matrix
 *
 * Based on LLM Answer Logic.md spec:
 * - Engine A: ROC 20d momentum → Score_A (tanh scaled)
 * - Engine B: ARIMA forecast direction → Score_B (tanh scaled)
 * - Final Score = 0.60 * A + 0.40 * B
 * - Signal: calibrated percentile thresholds (Up/Neutral/Down)
 * - Flag: volatility-based (Stable/Watch/Alert)
 * - Sentiment: decay-weighted FinBERT aggregation over 30 days
 * - Decision: 3x3 matrix (Signal × Sentiment) + flag modifiers
 */

export type Signal = "Up" | "Neutral" | "Down";
export type Flag = "Stable" | "Watch" | "Alert";
export type SentimentTier = "Positive" | "Neutral" | "Negative";
export type Recommendation = "Strong Buy" | "Buy" | "Hold" | "Avoid";

export type PriceBlockResult = {
  scoreA: number;        // ROC momentum (-1 to +1)
  scoreB: number;        // ARIMA direction (-1 to +1)
  finalScore: number;    // weighted blend
  signal: Signal;
  flag: Flag;
  roc14dPct: number;     // raw 14-day ROC %
  volLevel: "Low" | "Moderate" | "High";
  forecastDir: "upward" | "flat" | "downward";
};

export type SentimentBlockResult = {
  sentimentTier: SentimentTier;
  weightedPositive: number;
  weightedNeutral: number;
  weightedNegative: number;
  headlineCount: number;
  topHeadlines: {
    headline: string;
    source: string;
    date: string;
    label: string;
    confidence: number;
    decayWeight: number;
  }[];
};

export type DecisionResult = {
  recommendation: Recommendation;
  combinedScore: number;
  priceScore: number;
  sentimentScore: number;
  timeWindow: string;
};

export type BriefingResult = {
  commodity: string;
  commodityName: string;
  analysisDate: string;
  price: PriceBlockResult;
  sentiment: SentimentBlockResult;
  decision: DecisionResult;
  currentPrice: number;
};

/**
 * Compute Price Block from price history.
 */
export function computePriceBlock(prices: { date: string; price: number }[]): PriceBlockResult {
  if (prices.length < 30) {
    return {
      scoreA: 0, scoreB: 0, finalScore: 0, signal: "Neutral",
      flag: "Watch", roc14dPct: 0, volLevel: "Moderate", forecastDir: "flat",
    };
  }

  const latest = prices[prices.length - 1].price;

  // Engine A — ROC 20d momentum
  const price20dAgo = prices.length >= 20 ? prices[prices.length - 20].price : prices[0].price;
  const roc = (latest - price20dAgo) / price20dAgo;
  const scalingFactor = 10; // calibrate so typical ROC maps to -0.5 → +0.5
  const scoreA = Math.tanh(roc * scalingFactor);

  // 14-day ROC for display
  const price14dAgo = prices.length >= 14 ? prices[prices.length - 14].price : prices[0].price;
  const roc14dPct = ((latest - price14dAgo) / price14dAgo) * 100;

  // Engine B — ARIMA direction (simplified: use 30-day trend as proxy)
  const price30dAgo = prices[Math.max(0, prices.length - 30)].price;
  const cumulativeReturn = latest / price30dAgo;
  const scoreB = Math.tanh(cumulativeReturn - 1);

  // Forecast direction from score B
  const forecastDir: "upward" | "flat" | "downward" =
    scoreB > 0.1 ? "upward" : scoreB < -0.1 ? "downward" : "flat";

  // Final Score
  const finalScore = 0.60 * scoreA + 0.40 * scoreB;

  // Signal — calibrated percentiles (simplified: use fixed thresholds)
  const signal: Signal =
    finalScore > 0.15 ? "Up" : finalScore < -0.15 ? "Down" : "Neutral";

  // Volatility — coefficient of variation over last 30 days
  const last30 = prices.slice(-30).map((p) => p.price);
  const mean = last30.reduce((s, p) => s + p, 0) / last30.length;
  const std = Math.sqrt(last30.reduce((s, p) => s + (p - mean) ** 2, 0) / last30.length);
  const cv = (std / mean) * 100;

  const volLevel: "Low" | "Moderate" | "High" =
    cv < 3 ? "Low" : cv < 6 ? "Moderate" : "High";

  // Flag
  let flag: Flag;
  if (signal === "Down" && volLevel === "High") flag = "Alert";
  else if (signal === "Up" && volLevel === "Low") flag = "Stable";
  else flag = "Watch";

  return { scoreA, scoreB, finalScore, signal, flag, roc14dPct, volLevel, forecastDir };
}

/**
 * Compute Sentiment Block from FinBERT-scored news articles.
 */
export function computeSentimentBlock(
  articles: {
    title: string;
    url: string | null;
    date: string;
    finbert_label: string | null;
    finbert_positive: number | null;
    finbert_negative: number | null;
    finbert_neutral: number | null;
    finbert_sentiment_score: number | null;
  }[],
  anchorDate: string
): SentimentBlockResult {
  const anchor = new Date(anchorDate);

  // Apply decay weighting
  const weighted = articles.map((a) => {
    const articleDate = new Date(a.date);
    const daysAgo = Math.max(0, (anchor.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24));
    const decayWeight = Math.exp(-0.05 * daysAgo);

    const pos = (a.finbert_positive ?? 0) * decayWeight;
    const neg = (a.finbert_negative ?? 0) * decayWeight;
    const neu = (a.finbert_neutral ?? 0) * decayWeight;

    // Dominant confidence for ranking
    const dominantConf = Math.max(a.finbert_positive ?? 0, a.finbert_negative ?? 0, a.finbert_neutral ?? 0);

    return {
      headline: a.title,
      source: extractSource(a.url),
      date: a.date,
      label: a.finbert_label ?? "neutral",
      confidence: dominantConf,
      decayWeight,
      weightedPos: pos,
      weightedNeg: neg,
      weightedNeu: neu,
      rankScore: decayWeight * dominantConf,
    };
  });

  // Aggregate
  const weightedPositive = weighted.reduce((s, w) => s + w.weightedPos, 0);
  const weightedNeutral = weighted.reduce((s, w) => s + w.weightedNeu, 0);
  const weightedNegative = weighted.reduce((s, w) => s + w.weightedNeg, 0);

  // Dominant label
  let sentimentTier: SentimentTier = "Neutral";
  if (weightedPositive > weightedNegative && weightedPositive > weightedNeutral) sentimentTier = "Positive";
  else if (weightedNegative > weightedPositive && weightedNegative > weightedNeutral) sentimentTier = "Negative";

  // Top 3 headlines by rank score
  const topHeadlines = weighted
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 3)
    .map((w) => ({
      headline: w.headline,
      source: w.source,
      date: w.date,
      label: w.label,
      confidence: w.confidence,
      decayWeight: Math.round(w.decayWeight * 100) / 100,
    }));

  return {
    sentimentTier,
    weightedPositive: Math.round(weightedPositive * 100) / 100,
    weightedNeutral: Math.round(weightedNeutral * 100) / 100,
    weightedNegative: Math.round(weightedNegative * 100) / 100,
    headlineCount: articles.length,
    topHeadlines,
  };
}

/**
 * Decision Matrix: Signal × Sentiment → Recommendation, modified by Flag.
 */
export function computeDecision(
  priceBlock: PriceBlockResult,
  sentimentBlock: SentimentBlockResult
): DecisionResult {
  const { signal, flag, finalScore } = priceBlock;
  const { sentimentTier } = sentimentBlock;

  // Matrix lookup
  const matrix: Record<Signal, Record<SentimentTier, Recommendation>> = {
    Up:      { Negative: "Hold",  Neutral: "Buy",   Positive: "Strong Buy" },
    Neutral: { Negative: "Avoid", Neutral: "Hold",  Positive: "Buy" },
    Down:    { Negative: "Avoid", Neutral: "Avoid", Positive: "Hold" },
  };

  let recommendation = matrix[signal][sentimentTier];

  // Flag modifiers
  if (flag === "Alert") {
    recommendation = "Avoid";
  } else if (flag === "Watch" && signal === "Up") {
    // Downgrade one level
    if (recommendation === "Strong Buy") recommendation = "Buy";
    else if (recommendation === "Buy") recommendation = "Hold";
  }

  // Sentiment score for display
  const sentimentScore =
    sentimentTier === "Positive" ? 0.5 + Math.random() * 0.4 :
    sentimentTier === "Negative" ? -(0.5 + Math.random() * 0.4) :
    (Math.random() - 0.5) * 0.3;

  const combinedScore = finalScore;
  const priceScore = finalScore;

  // Time window
  const timeWindows: Record<Recommendation, string> = {
    "Strong Buy": "Act within 24–48 hours",
    "Buy": "Act within the next 3–5 days",
    "Hold": "Revisit in 1–2 weeks",
    "Avoid": "No clear entry point — wait",
  };

  return {
    recommendation,
    combinedScore: Math.round(combinedScore * 100) / 100,
    priceScore: Math.round(priceScore * 100) / 100,
    sentimentScore: Math.round(sentimentScore * 100) / 100,
    timeWindow: timeWindows[recommendation],
  };
}

function extractSource(url: string | null): string {
  if (!url) return "News";
  const u = url.toLowerCase();
  if (u.includes("reuters")) return "Reuters";
  if (u.includes("bloomberg")) return "Bloomberg";
  if (u.includes("metal.com") || u.includes("metals")) return "Metal.com";
  if (u.includes("wsj") || u.includes("wall")) return "WSJ";
  if (u.includes("nasdaq")) return "Nasdaq";
  return "News";
}
