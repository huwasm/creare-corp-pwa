"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { Commodity, PriceRow } from "@/lib/queries";
import { computeSignals } from "@/lib/queries";
import type { ForecastPoint } from "@/lib/forecast";

type ChartType = "line" | "area" | "bar";
type ForecastHorizon = 0 | 7 | 14 | 21 | 30;

type Props = {
  commodity: Commodity;
  prices: PriceRow[];
  onClose: () => void;
  onDateSelect?: (date: string) => void;
};

const TIME_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: 9999 },
];

const FORECAST_OPTIONS: { label: string; days: ForecastHorizon }[] = [
  { label: "Off", days: 0 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "21 days", days: 21 },
  { label: "30 days", days: 30 },
];

export function PriceChart({ commodity, prices, onClose, onDateSelect }: Props) {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [timeRange, setTimeRange] = useState(90);
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(0);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showForecastDropdown, setShowForecastDropdown] = useState(false);

  // Fetch forecast when horizon changes
  useEffect(() => {
    if (forecastHorizon === 0) {
      setForecastData([]);
      return;
    }

    setForecastLoading(true);
    fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commodity_slug: commodity.slug,
        horizon_days: forecastHorizon,
        lookback_days: 90,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.forecast) {
          setForecastData(data.forecast);
        }
      })
      .catch(console.error)
      .finally(() => setForecastLoading(false));
  }, [forecastHorizon, commodity.slug]);

  // Filter prices
  const filteredPrices =
    timeRange >= 9999
      ? prices
      : prices.slice(Math.max(0, prices.length - timeRange));

  const signals = computeSignals(filteredPrices);

  const formatLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (timeRange >= 365 || (timeRange >= 9999)) {
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    if (timeRange >= 30) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Build combined chart data: actual prices + forecast
  const chartData = filteredPrices.map((p) => ({
    date: p.date,
    price: p.price,
    forecast: null as number | null,
    upper: null as number | null,
    lower: null as number | null,
    label: formatLabel(p.date),
    isForecast: false,
  }));

  // Add forecast points
  if (forecastData.length > 0 && forecastHorizon > 0) {
    // Bridge: last actual price connects to first forecast
    const lastActual = chartData[chartData.length - 1];
    if (lastActual) {
      lastActual.forecast = lastActual.price;
      lastActual.upper = lastActual.price;
      lastActual.lower = lastActual.price;
    }

    for (const fp of forecastData) {
      chartData.push({
        date: fp.date,
        price: null as unknown as number,
        forecast: fp.price,
        upper: fp.upper,
        lower: fp.lower,
        label: formatLabel(fp.date),
        isForecast: true,
      });
    }
  }

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleChartClick(state: any) {
    if (state?.activePayload?.[0]?.payload?.date) {
      onDateSelect?.(state.activePayload[0].payload.date);
    }
  }

  const forecastLabel = FORECAST_OPTIONS.find((o) => o.days === forecastHorizon)?.label ?? "Off";

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#c9a44a] bg-[#1a1d28]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2d3a] px-5 py-3.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[13px] font-bold"
              style={{ backgroundColor: commodity.color_hex + "20", color: commodity.color_hex }}
            >
              {commodity.symbol}
            </div>
            <span className="text-base font-semibold text-white">{commodity.name}</span>
          </div>
          <span className="font-mono text-2xl font-bold text-white">
            ${signals.latest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            className={`rounded-md px-2.5 py-1 text-[13px] font-semibold ${
              signals.changePct >= 0
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {signals.changePct >= 0 ? "+" : ""}
            {signals.changePct.toFixed(2)}%
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Forecast dropdown — LEFT of chart type */}
          <div className="relative">
            <button
              onClick={() => setShowForecastDropdown(!showForecastDropdown)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                forecastHorizon > 0
                  ? "border-[#4caf50] bg-[#4caf50]/10 text-[#4caf50]"
                  : "border-[#3a3d4a] text-gray-500 hover:border-[#4a4d5a] hover:text-gray-300"
              }`}
            >
              <span>📈</span>
              <span>{forecastHorizon > 0 ? `Forecast ${forecastLabel}` : "Forecast"}</span>
              <span className="text-[9px]">▾</span>
            </button>
            {showForecastDropdown && (
              <div className="absolute left-0 top-9 z-50 w-[140px] overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838] shadow-xl">
                {FORECAST_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => { setForecastHorizon(opt.days); setShowForecastDropdown(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors ${
                      forecastHorizon === opt.days
                        ? "bg-[#c9a44a]/10 text-[#c9a44a]"
                        : "text-gray-400 hover:bg-[#1f2233]"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {forecastHorizon === opt.days && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chart type pills */}
          <div className="flex overflow-hidden rounded-lg border border-[#3a3d4a] bg-[#252838]">
            {(["line", "area", "bar"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  chartType === t
                    ? "bg-[#c9a44a] font-semibold text-[#0f1117]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Time range pills */}
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setTimeRange(r.days)}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  timeRange === r.days
                    ? "border-[#4a4d5a] bg-[#2a2d3a] text-white"
                    : "border-[#3a3d4a] text-gray-600 hover:border-[#4a4d5a] hover:text-gray-400"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3a3d4a] text-gray-500 transition-colors hover:border-red-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Forecast loading indicator */}
      {forecastLoading && (
        <div className="flex items-center gap-2 border-b border-[#2a2d3a] bg-[#161822] px-5 py-1.5">
          <span className="animate-pulse text-xs text-[#4caf50]">●</span>
          <span className="text-[10px] text-gray-500">Computing ARIMA forecast...</span>
        </div>
      )}

      {/* Chart — using ComposedChart to overlay actual + forecast */}
      <div className="h-[360px] px-5 py-4" style={{ cursor: "crosshair" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} onClick={handleChartClick}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={commodity.color_hex} stopOpacity={0.15} />
                <stop offset="100%" stopColor={commodity.color_hex} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4caf50" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#4caf50" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1f2233" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} interval={tickInterval} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#444", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={60} />
            <Tooltip content={<ChartTooltip />} />

            {/* Average reference line */}
            <ReferenceLine y={signals.avg} stroke="#3a3d4a" strokeDasharray="4 4" />

            {/* Last data point vertical marker (when forecast is on) */}
            {forecastData.length > 0 && filteredPrices.length > 0 && (
              <ReferenceLine
                x={formatLabel(filteredPrices[filteredPrices.length - 1].date)}
                stroke="#4caf50"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}

            {/* Confidence band (shaded area between upper and lower) */}
            {forecastData.length > 0 && (
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#forecastGrad)"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            )}
            {forecastData.length > 0 && (
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#1a1d28"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            )}

            {/* Actual price */}
            {chartType === "bar" ? (
              <Bar dataKey="price" fill={commodity.color_hex} opacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            ) : chartType === "area" ? (
              <Area type="monotone" dataKey="price" stroke={commodity.color_hex} strokeWidth={2} fill="url(#areaGrad)" dot={false} isAnimationActive={false} activeDot={{ r: 5, stroke: "#c9a44a", strokeWidth: 2, fill: "#0f1117" }} />
            ) : (
              <Line type="monotone" dataKey="price" stroke={commodity.color_hex} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 5, stroke: "#c9a44a", strokeWidth: 2, fill: "#0f1117" }} />
            )}

            {/* Forecast line (dotted, green) */}
            {forecastData.length > 0 && (
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#4caf50"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
                activeDot={{ r: 4, stroke: "#4caf50", strokeWidth: 2, fill: "#0f1117" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap gap-6 border-t border-[#2a2d3a] bg-[#161822] px-5 py-3.5">
        <Stat label="Open" value={`$${signals.open.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="High" value={`$${signals.high.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="up" />
        <Stat label="Low" value={`$${signals.low.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="down" />
        <Stat label="Change" value={`${signals.change >= 0 ? "+" : ""}$${signals.change.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${signals.changePct >= 0 ? "+" : ""}${signals.changePct.toFixed(2)}%)`} type={signals.changePct >= 0 ? "up" : "down"} />
        <Stat label="Avg" value={`$${signals.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="Volatility" value={`${signals.volatility30d.toFixed(1)}%`} type={signals.volatility30d > 20 ? "warn" : "neutral"} />
        {forecastData.length > 0 && (
          <>
            <Stat label={`Forecast (${forecastHorizon}D)`} value={`$${forecastData[forecastData.length - 1]?.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="forecast" />
            <Stat label="Range" value={`$${forecastData[forecastData.length - 1]?.lower.toLocaleString(undefined, { maximumFractionDigits: 0 })} – $${forecastData[forecastData.length - 1]?.upper.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} type="forecast" />
          </>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const isForecast = data.isForecast;
  const price = data.forecast ?? data.price;
  if (!price) return null;

  return (
    <div className="rounded-lg border border-[#3a3d4a] bg-[#252838] px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400">
        {new Date(data.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        {isForecast && <span className="ml-1 text-[#4caf50]">(forecast)</span>}
      </p>
      <p className={`font-semibold ${isForecast ? "text-[#4caf50]" : "text-[#E87040]"}`}>
        {isForecast ? "Forecast" : "Price"} : ${Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
      {isForecast && data.lower && data.upper && (
        <p className="text-gray-500">
          Range: ${Number(data.lower).toLocaleString(undefined, { maximumFractionDigits: 0 })} – ${Number(data.upper).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, type }: { label: string; value: string; type?: "up" | "down" | "warn" | "neutral" | "forecast" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">{label}</span>
      <span
        className={`font-mono text-[13px] font-semibold ${
          type === "up" ? "text-green-400" : type === "down" ? "text-red-400" : type === "warn" ? "text-yellow-400" : type === "forecast" ? "text-[#4caf50]" : "text-gray-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
