"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import type { BriefingResult } from "@/lib/briefing-engine";

export default function BriefingPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0f1117] text-gray-600">Loading...</div>}>
      <BriefingPageInner />
    </Suspense>
  );
}

const EMOJI_MAP: Record<string, string> = {
  positive: "📈",
  negative: "📉",
  neutral: "➖",
};

const REC_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Strong Buy": { bg: "rgba(76,175,80,0.25)", border: "rgba(76,175,80,0.5)", text: "#4caf50" },
  "Buy": { bg: "rgba(76,175,80,0.15)", border: "rgba(76,175,80,0.3)", text: "#4caf50" },
  "Hold": { bg: "rgba(255,193,7,0.15)", border: "rgba(255,193,7,0.3)", text: "#ffc107" },
  "Avoid": { bg: "rgba(239,83,80,0.15)", border: "rgba(239,83,80,0.3)", text: "#ef5350" },
};

const SIGNAL_COLORS: Record<string, string> = {
  Up: "#4caf50", Neutral: "#ffc107", Down: "#ef5350",
};

function BriefingPageInner() {
  const searchParams = useSearchParams();
  const commodityParam = searchParams.get("commodity") || "copper_lme";

  const [commodity, setCommodity] = useState(commodityParam);
  const [role, setRole] = useState<"trader" | "buyer">("trader");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/briefing?commodity=${commodity}`)
      .then((r) => r.json())
      .then((data) => { setBriefing(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [commodity]);

  const recStyle = briefing ? REC_COLORS[briefing.decision.recommendation] : REC_COLORS["Hold"];
  const signalColor = briefing ? SIGNAL_COLORS[briefing.price.signal] : "#ffc107";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        commodity={commodity}
        onCommodityChange={setCommodity}
        role={role}
        onRoleChange={setRole}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeView="charts"
          onViewChange={() => {}}
        />

        <main className="flex-1 overflow-y-auto px-5 py-5">
          {/* Welcome bar with tabs */}
          <div className="mb-5 flex items-center justify-between rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28] px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Welcome Back!</h2>
              <p className="mt-0.5 text-[11px] text-gray-600">LME Metals Monitor — {new Date().toLocaleDateString("en-GB")}</p>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
              <Link href="/charts" className="px-3.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300">▦ Overview</Link>
              <Link href="/charts" className="px-3.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300">📈 Single</Link>
              <Link href="/charts" className="px-3.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300">📊 Compare</Link>
              <span className="bg-[#c9a44a] px-3.5 py-1.5 text-xs font-semibold text-[#0f1117]">🎯 Briefing</span>
            </div>
          </div>

          {loading ? (
            <div className="flex h-[400px] items-center justify-center rounded-[14px] border border-[#2a2d3a] bg-[#1a1d28]">
              <span className="text-sm text-gray-600">Computing briefing...</span>
            </div>
          ) : briefing ? (
            <div className="max-w-[900px]">
              <div className="overflow-hidden rounded-[14px] border bg-[#1a1d28]" style={{ borderColor: recStyle.border }}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#2a2d3a] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg font-mono text-[15px] font-bold"
                      style={{ backgroundColor: signalColor + "20", color: signalColor }}
                    >
                      {briefing.commodityName.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{briefing.commodityName}</div>
                      <div className="text-[11px] text-gray-500">Analysis for {new Date(briefing.analysisDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · LME · USD/mt</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-white">${briefing.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="font-mono text-sm font-semibold" style={{ color: recStyle.text }}>Final Score: {briefing.decision.combinedScore >= 0 ? "+" : ""}{briefing.decision.combinedScore}</div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 border-b border-[#2a2d3a] bg-[#161822] px-6 py-2.5">
                  <Badge label={`↓ ${briefing.price.signal}`} color={signalColor} />
                  <Badge label={`${briefing.price.flag === "Alert" ? "⚠" : briefing.price.flag === "Stable" ? "✓" : "👁"} ${briefing.price.flag}`} color={signalColor} />
                  <Badge label={briefing.sentiment.sentimentTier} color={signalColor} />
                  <Badge label={`Vol: ${briefing.price.volLevel}`} color="#888" dim />
                  <Badge label={`Forecast: ${briefing.price.forecastDir}`} color="#888" dim />
                  <Badge label={`14d ROC: ${briefing.price.roc14dPct >= 0 ? "+" : ""}${briefing.price.roc14dPct.toFixed(1)}%`} color="#888" dim />
                </div>

                {/* Recommendation Hero */}
                <div className="flex items-center justify-between border-b border-[#2a2d3a] px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="rounded-[10px] border-2 px-7 py-2.5 text-[22px] font-extrabold uppercase tracking-wide"
                      style={{ backgroundColor: recStyle.bg, borderColor: recStyle.border, color: recStyle.text }}
                    >
                      {briefing.decision.recommendation}
                    </div>
                    <div>
                      <div className="text-[13px] text-gray-400">{briefing.decision.timeWindow}</div>
                      <div className="mt-0.5 text-[10px] text-gray-600">
                        Matrix: {briefing.price.signal} × {briefing.sentiment.sentimentTier} → {briefing.decision.recommendation}
                        {briefing.price.flag === "Alert" && " · Flag: Alert → override"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <ScoreBox label="Price" value={briefing.decision.priceScore} />
                    <ScoreBox label="Sentiment" value={briefing.decision.sentimentScore} />
                    <ScoreBox label="Combined" value={briefing.decision.combinedScore} />
                  </div>
                </div>

                {/* Two-column body */}
                <div className="grid grid-cols-2 border-t border-[#2a2d3a]">
                  {/* Left: Price Summary */}
                  <div className="border-r border-[#2a2d3a] p-6">
                    <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Price Summary</div>
                    <p className="text-[13px] leading-relaxed text-gray-300">
                      {briefing.commodityName} has {briefing.price.roc14dPct >= 0 ? "gained" : "lost"} {Math.abs(briefing.price.roc14dPct).toFixed(1)}% over the past two weeks.
                      {briefing.price.forecastDir === "downward"
                        ? " The pressure does not appear to be easing — the short-term outlook points to further decline."
                        : briefing.price.forecastDir === "upward"
                          ? " The trajectory remains firmly upward with momentum continuing."
                          : " The direction remains unclear with no strong trend emerging."}
                      {briefing.price.volLevel === "High"
                        ? " Price swings have been larger than usual, adding uncertainty."
                        : briefing.price.volLevel === "Low"
                          ? " Volatility is low, suggesting steady and predictable movement."
                          : ""}
                    </p>

                    {/* Score breakdown */}
                    <div className="mt-4 border-t border-[#1f2233] pt-3">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Score Breakdown</div>
                      <div className="flex gap-4">
                        <MiniScore label="Engine A (ROC 20d)" value={briefing.price.scoreA} />
                        <MiniScore label="Engine B (ARIMA)" value={briefing.price.scoreB} />
                        <MiniScore label="Weighted (60/40)" value={briefing.price.finalScore} />
                        <div>
                          <div className="text-[9px] text-gray-600">Vol Level</div>
                          <div className={`font-mono text-[13px] font-semibold ${briefing.price.volLevel === "High" ? "text-red-400" : briefing.price.volLevel === "Low" ? "text-green-400" : "text-yellow-400"}`}>
                            {briefing.price.volLevel}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Market News */}
                  <div className="p-6">
                    <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Market News (30-day window, decay-weighted)</div>

                    {briefing.sentiment.topHeadlines.map((h, i) => (
                      <div key={i} className={`flex items-start gap-2 ${i < 2 ? "mb-3.5 border-b border-[#1f2233] pb-3.5" : ""}`}>
                        <span className="mt-0.5 text-base">{EMOJI_MAP[h.label] ?? "➖"}</span>
                        <div>
                          <div className="text-xs leading-relaxed text-gray-300">{h.headline}</div>
                          <div className="mt-1 flex gap-2 text-[10px] text-gray-600">
                            <span>{h.source}</span>
                            <span>{new Date(h.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span style={{ color: h.label === "positive" ? "#4caf50" : h.label === "negative" ? "#ef5350" : "#ffc107" }}>
                              {h.label.charAt(0).toUpperCase() + h.label.slice(1)} ({h.confidence.toFixed(2)})
                            </span>
                            <span>Decay: {h.decayWeight}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Sentiment aggregate */}
                    <div className="mt-4 border-t border-[#1f2233] pt-3">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Sentiment Aggregate (30d)</div>
                      <div className="flex gap-4">
                        <MiniScore label="Positive" value={briefing.sentiment.weightedPositive} color="#4caf50" raw />
                        <MiniScore label="Neutral" value={briefing.sentiment.weightedNeutral} color="#ffc107" raw />
                        <MiniScore label="Negative" value={briefing.sentiment.weightedNegative} color="#ef5350" raw />
                        <div>
                          <div className="text-[9px] text-gray-600">Articles</div>
                          <div className="font-mono text-[13px] font-semibold text-gray-400">{briefing.sentiment.headlineCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Closing recommendation */}
                <div
                  className={`border-t border-[#2a2d3a] bg-[#161822] px-6 py-4 text-sm leading-relaxed text-gray-300 ${
                    briefing.decision.recommendation === "Avoid" ? "border-l-[3px] border-l-red-500" :
                    briefing.decision.recommendation === "Strong Buy" ? "border-l-[3px] border-l-green-500" :
                    briefing.decision.recommendation === "Buy" ? "border-l-[3px] border-l-green-400" :
                    "border-l-[3px] border-l-yellow-500"
                  }`}
                >
                  {briefing.decision.recommendation === "Avoid"
                    ? `This is not the right moment to act on ${briefing.commodityName.toLowerCase()} — it is worth waiting for conditions to improve before revisiting.`
                    : briefing.decision.recommendation === "Strong Buy"
                      ? `Conditions are aligned for ${briefing.commodityName.toLowerCase()} right now — upward momentum, supportive news environment, and stable volatility. Current levels look favorable for action within 24–48 hours.`
                      : briefing.decision.recommendation === "Buy"
                        ? `${briefing.commodityName} is showing positive signals. Consider building a position within the next 3–5 days while conditions remain supportive.`
                        : `${briefing.commodityName} is in a holding pattern. There is no urgency to act — conditions should become clearer over the next two weeks.`}
                </div>
              </div>

              <p className="mt-3 text-[10px] text-gray-600">
                Switch commodity in the header dropdown. <Link href="/charts" className="text-[#c9a44a] hover:underline">Back to Charts →</Link> to discuss this briefing in chat.
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-600">Failed to load briefing.</div>
          )}
        </main>
      </div>
    </div>
  );
}

function Badge({ label, color, dim }: { label: string; color: string; dim?: boolean }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: dim ? `${color}10` : `${color}20`,
        color: dim ? "#888" : color,
        border: `1px solid ${dim ? "#2a2d3a" : color + "40"}`,
      }}
    >
      {label}
    </span>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  const color = value >= 0 ? "#4caf50" : "#ef5350";
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-gray-600">{label}</div>
      <div className="font-mono text-lg font-bold" style={{ color }}>
        {value >= 0 ? "+" : ""}{value.toFixed(2)}
      </div>
    </div>
  );
}

function MiniScore({ label, value, color, raw }: { label: string; value: number; color?: string; raw?: boolean }) {
  const c = color ?? (value >= 0 ? "#4caf50" : "#ef5350");
  return (
    <div>
      <div className="text-[9px] text-gray-600">{label}</div>
      <div className="font-mono text-[13px] font-semibold" style={{ color: c }}>
        {raw ? value.toFixed(2) : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`}
      </div>
    </div>
  );
}
