import type { ForecastTrend } from "@/lib/types/stock";
import type { ChartPoint, StockAnalysis } from "@/lib/types/stock-analysis";

import type { StockSeed } from "@/lib/data/stock-seeds";
import {
  directionFromChangePct,
  formatChangePct,
} from "@/lib/market/change-direction";
import { stockChartYAxisDomain } from "@/lib/market/chart-domain";
import { resolveListingLabels } from "@/lib/pse/apply-official-labels";
import {
  SIGNAL_HORIZON_DAYS,
  computeConsensusSignal,
  consensusTargetPrice,
} from "@/lib/signal/consensus";
import { computeEntryExitPlan } from "@/lib/signal/entry-exit";

const MODEL_ROWS = [
  {
    model: "Naive Baseline",
    mae: "2.45",
    rmse: "3.12",
    mape: "1.78%",
    notes: "Previous day's price",
  },
  {
    model: "Moving Average (5-day)",
    mae: "1.98",
    rmse: "2.54",
    mape: "1.43%",
    notes: "Simple average of last 5 days",
  },
  {
    model: "Linear Regression",
    mae: "1.76",
    rmse: "2.21",
    mape: "1.28%",
    notes: "Trend-based extrapolation",
  },
  {
    model: "LSTM",
    mae: "1.32",
    rmse: "1.67",
    mape: "0.96%",
    notes: "Deep learning sequence model",
  },
] as const;

const CHART_DATES = [
  "May 2",
  "May 5",
  "May 6",
  "May 7",
  "May 8",
  "May 9",
  "May 12",
  "May 13",
  "May 14",
  "May 15",
  "May 16",
  "May 17",
  "May 18",
  "May 19",
  "May 20",
  "May 21",
  "May 22",
  "May 23",
];

function seedHash(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) {
    h = (h * 31 + ticker.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function roundToTick(price: number, ref: number): number {
  if (ref >= 1000) return Math.round(price * 10) / 10;
  if (ref >= 100) return Math.round(price * 100) / 100;
  if (ref >= 10) return Math.round(price * 100) / 100;
  return Math.round(price * 1000) / 1000;
}

function formatPrice(amount: number, isIndex: boolean): string {
  if (isIndex) {
    return amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (amount >= 1000) {
    return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₱${amount.toFixed(2)}`;
}

function formatVolume(millions: number): string {
  if (millions <= 0) return "—";
  if (millions >= 1) return `${millions.toFixed(1)}M`;
  return `${(millions * 1000).toFixed(0)}K`;
}

function buildHistorical(
  lastClose: number,
  trend: ForecastTrend,
  hash: number,
): number[] {
  const points = 11;
  const startBias =
    trend === "Projected Upward"
      ? -0.028
      : trend === "Projected Downward"
        ? 0.018
        : -0.004;
  const prices: number[] = [];
  let price = lastClose * (1 + startBias);

  for (let i = 0; i < points; i++) {
    const drift =
      trend === "Projected Upward"
        ? 0.0028
        : trend === "Projected Downward"
          ? -0.0022
          : 0.0004;
    const noise = (((hash + i * 17) % 100) - 50) / 5000;
    price = price * (1 + drift + noise);
    prices.push(roundToTick(price, lastClose));
  }
  prices[points - 1] = lastClose;
  return prices;
}

function buildForecast(
  lastClose: number,
  trend: ForecastTrend,
  hash: number,
): number[] {
  const days = 7;
  const totalMove =
    trend === "Projected Upward"
      ? 0.025 + (hash % 10) / 1000
      : trend === "Projected Downward"
        ? -0.018 - (hash % 8) / 1000
        : 0.004 + (hash % 5) / 1000;
  const prices: number[] = [];
  let price = lastClose;

  for (let i = 0; i < days; i++) {
    const step = totalMove / days;
    price = price * (1 + step);
    prices.push(roundToTick(price, lastClose));
  }
  return prices;
}

function buildChart(historical: number[], forecast: number[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let i = 0; i < historical.length; i++) {
    points.push({
      date: CHART_DATES[i] ?? `May ${2 + i}`,
      price: historical[i],
      forecast: null,
    });
  }
  for (let j = 0; j < forecast.length; j++) {
    const idx = historical.length + j;
    points.push({
      date: CHART_DATES[idx] ?? `May ${17 + j}`,
      price: null,
      forecast: forecast[j],
    });
  }
  return points;
}

function chartDomain(
  historical: number[],
  forecast: number[],
  isIndex: boolean,
): [number, number] {
  return stockChartYAxisDomain([...historical, ...forecast], { isIndex });
}

function sectorNote(sector: string, positive: boolean): string {
  const tone = positive ? "outperforming" : "under pressure";
  return `${sector} names are ${tone} this week amid mixed macro data and FX moves.`;
}

function trendSummary(
  seed: StockSeed,
  target: number,
  isIndex: boolean,
): string {
  const from = formatPrice(seed.lastClose, isIndex);
  const to = formatPrice(target, isIndex);
  if (seed.trend === "Mixed Signal") {
    return `${seed.shortName} is range-bound with the model projecting a narrow band around ${to} from ${from}.`;
  }
  const dir = seed.trend === "Projected Upward" ? "upside" : "downside";
  return `${seed.shortName} shows ${dir} over the next 7 trading days, from ${from} toward about ${to}.`;
}

export function buildStockAnalysisFromSeed(seed: StockSeed): StockAnalysis {
  const labels = resolveListingLabels(
    seed.ticker,
    seed.sector,
    seed.sector,
  );
  const isIndex = labels.sector === "Index";
  const hash = seedHash(seed.ticker);
  const historical = buildHistorical(seed.lastClose, seed.trend, hash);
  const forecast = buildForecast(seed.lastClose, seed.trend, hash);
  const chartData = buildChart(historical, forecast);
  const forecastTarget = forecast[forecast.length - 1] ?? seed.lastClose;
  const domain = chartDomain(historical, forecast, isIndex);
  const changeDirection = directionFromChangePct(seed.dailyChangePct);
  const positive = changeDirection === "up";
  const weekLow = seed.lastClose * (1 - seed.weekLowPct / 100);
  const weekHigh = seed.lastClose * (1 + seed.weekHighPct / 100);

  const scale = seed.lastClose >= 100 ? 0.01 : 0.005;
  const mae = (seed.lastClose * scale).toFixed(2);
  const rmse = (seed.lastClose * scale * 1.25).toFixed(2);

  // The demo seed only has 11 fabricated history points (well under
  // MIN_CLOSES_FOR_SIGNAL), so this path naturally reports "insufficient
  // data" rather than fabricating a signal from fabricated prices — more
  // honest than the alternative on a snapshot/CI fallback path.
  const signal = isIndex ? null : computeConsensusSignal(historical, SIGNAL_HORIZON_DAYS, []);
  const entryExitPlan =
    isIndex || !signal?.dataSufficient
      ? null
      : computeEntryExitPlan(
          signal.action,
          seed.lastClose,
          null,
          null,
          null,
          consensusTargetPrice(signal.votes),
        );

  return {
    info: {
      name: seed.name,
      ticker: seed.ticker,
      sector: labels.sector,
      subsector: labels.subsector,
    },
    metrics: {
      lastClose: formatPrice(seed.lastClose, isIndex),
      dailyChange: formatChangePct(seed.dailyChangePct),
      dailyChangePositive: positive,
      volume: formatVolume(seed.volumeM),
      weekRange: isIndex
        ? `${Math.round(weekLow).toLocaleString("en-PH")} - ${Math.round(weekHigh).toLocaleString("en-PH")}`
        : `${formatPrice(weekLow, false)} - ${formatPrice(weekHigh, false)}`,
    },
    lastUpdated: "May 16, 2026 at 2:30 PM PST",
    trend: seed.trend,
    forecastTarget: formatPrice(forecastTarget, isIndex),
    chartData,
    chartDomain: domain,
    forecastStartDate: "May 16",
    performance: {
      mae,
      rmse,
      mape: `${(scale * 100).toFixed(2)}%`,
      directionalAccuracy: `${seed.directionalAccuracy}%`,
    },
    modelComparison: MODEL_ROWS.map((row) =>
      row.model === "LSTM"
        ? { ...row, mae, rmse, mape: `${(scale * 100).toFixed(2)}%` }
        : { ...row },
    ),
    signal,
    entryExitPlan,
    // Seed data has no real shares-outstanding to compute market cap from —
    // an honest null beats a fabricated company-size number.
    companyStats: null,
    fundamentals: null,
    aiInsight: {
      summary: trendSummary(seed, forecastTarget, isIndex),
      caution: `Directional accuracy is ${seed.directionalAccuracy}% for this ticker. Use for research only—not investment advice.`,
      context: sectorNote(labels.sector, positive),
    },
    marketContext: {
      disclosures: [seed.disclosure1, seed.disclosure2],
      pseiIndex: "5,893",
      pseiChange: "+0.1%",
      pseiPositive: true,
      sectorNote: sectorNote(labels.sector, positive),
    },
  };
}
