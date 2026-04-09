/**
 * ARIMA Forecast Engine
 *
 * Uses the `arima` npm package for time series forecasting.
 * No Python needed — runs in Node.js.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ARIMA = require("arima");

export type ForecastPoint = {
  date: string;
  price: number;
  lower: number;
  upper: number;
};

export type ForecastResult = {
  commodity: string;
  horizon: number;
  lastDataDate: string;
  forecast: ForecastPoint[];
  modelOrder: number[];
};

/**
 * Run ARIMA forecast on price data.
 *
 * @param prices - array of { date, price } sorted ascending
 * @param horizonDays - how many days to forecast (7, 14, 21, 30)
 * @param lookbackDays - how many historical days to use for fitting (default: 90)
 */
export function computeForecast(
  prices: { date: string; price: number }[],
  horizonDays: number,
  lookbackDays = 90
): ForecastResult {
  if (prices.length < 10) {
    throw new Error("Not enough price data for forecasting (need at least 10 data points)");
  }

  // Use last N days for fitting
  const fitData = prices.slice(-lookbackDays);
  const priceValues = fitData.map((p) => p.price);
  const lastDate = fitData[fitData.length - 1].date;
  const commodity = ""; // Set by caller

  // Fit ARIMA model with auto parameters
  const arima = new ARIMA({
    p: 2,
    d: 1,
    q: 2,
    verbose: false,
  });

  arima.train(priceValues);

  // Forecast
  const [forecastValues, forecastErrors] = arima.predict(horizonDays);

  // Generate future dates (skip weekends for trading days)
  const futureDates = generateTradingDates(lastDate, horizonDays);

  // Build forecast points with confidence intervals
  const forecast: ForecastPoint[] = forecastValues.map(
    (price: number, i: number) => {
      const stderr = forecastErrors?.[i] ?? 0;
      // 95% confidence interval
      const margin = 1.96 * Math.sqrt(Math.abs(stderr));
      return {
        date: futureDates[i],
        price: Math.round(price * 100) / 100,
        lower: Math.round((price - margin) * 100) / 100,
        upper: Math.round((price + margin) * 100) / 100,
      };
    }
  );

  return {
    commodity,
    horizon: horizonDays,
    lastDataDate: lastDate,
    forecast,
    modelOrder: [2, 1, 2],
  };
}

/**
 * Generate N trading dates after a given date (skip weekends).
 */
function generateTradingDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);

  while (dates.length < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }

  return dates;
}
