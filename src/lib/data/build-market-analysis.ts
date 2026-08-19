import { getStockAnalysisStatic } from "@/lib/data/stocks";
import {
  CHART_HISTORY_DAYS,
  generateForecast,
  forecastTargetFromPoints,
} from "@/lib/forecast/generate";
import { horizonToDays } from "@/lib/forecast/horizon";
import { bestModelMetrics } from "@/lib/forecast/backtest";
import type { ForecastModel } from "@/lib/forecast/types";
import { weekRangeFromBars } from "@/lib/market/bars-repository";
import { getCompanyStats } from "@/lib/market/company-stats-repository";
import { getFundamentals } from "@/lib/market/fundamentals-repository";
import { stockChartYAxisDomain } from "@/lib/market/chart-domain";
import { computeIndicators, computeSupportResistance } from "@/lib/market/indicators";
import {
  formatAsOf,
  formatPriceAmount,
  quoteToDisplay,
} from "@/lib/market/format-quote";
import {
  SIGNAL_HORIZON_DAYS,
  computeTickerSignal,
  consensusTargetPrice,
} from "@/lib/signal/consensus";
import { computeEntryExitPlan } from "@/lib/signal/entry-exit";
import {
  getForecastFromSnapshot,
  getMetricsFromSnapshot,
} from "@/lib/market/forecasts-snapshot";
import {
  fetchModelMetrics,
  fetchForecastPoints,
  type StoredModelMetrics,
} from "@/lib/market/forecasts-repository";
import type { MarketBar, MarketQuote } from "@/lib/market/types";
import { applyOfficialLabelsToAnalysis } from "@/lib/pse/apply-official-labels";
import { getPseCompanyByTicker } from "@/lib/pse/universe";
import { roundToDisplayPrecision, trendFromPrices } from "@/lib/forecast";
import type { ForecastTrend } from "@/lib/types/stock";
import type {
  ChartPoint,
  ModelComparisonRow,
  PerformanceMetrics,
  StockAnalysis,
} from "@/lib/types/stock-analysis";
import { isDbMarketEnabled } from "@/lib/db/config";

const MODEL_LABELS: Record<string, string> = {
  naive: "Naive Baseline",
  ma: "Moving Average",
  linear: "Linear Regression",
  lstm: "LSTM",
};

function formatBarDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function barsToHistoryPoints(bars: MarketBar[]): ChartPoint[] {
  return bars.map((bar) => ({
    date: formatBarDate(bar.tradeDate),
    price: Number(bar.close),
    forecast: null,
  }));
}

function chartValuesFromPoints(points: ChartPoint[]): number[] {
  return points.flatMap((p) => [p.price, p.forecast]).filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
}

function formatTarget(price: number, isIndex: boolean): string {
  if (isIndex) return Math.round(price).toLocaleString("en-PH");
  return formatPriceAmount(price);
}

// Mirrors build-stock-analysis.ts's demo-seed text templates, but built from
// live metrics/performance instead of the static seed — base.aiInsight and
// base.marketContext.sectorNote otherwise stay frozen at whatever the demo
// seed said (e.g. a stale price/accuracy that contradicts the live numbers
// shown elsewhere on the same page).
function trendSummary(
  name: string,
  from: string,
  to: string,
  trend: ForecastTrend,
): string {
  if (trend === "Mixed Signal") {
    return `${name} is range-bound with the model projecting a narrow band around ${to} from ${from}.`;
  }
  const dir = trend === "Projected Upward" ? "upside" : "downside";
  return `${name} shows ${dir} over the next 7 trading days, from ${from} toward about ${to}.`;
}

function sectorNote(sector: string, positive: boolean): string {
  const tone = positive ? "outperforming" : "under pressure";
  return `${sector} names are ${tone} this week amid mixed macro data and FX moves.`;
}

function metricsToPerformance(m: {
  mae: number;
  rmse: number;
  mape: number;
  dirAccuracy: number | null;
}): PerformanceMetrics {
  return {
    mae: m.mae.toFixed(2),
    rmse: m.rmse.toFixed(2),
    mape: `${m.mape.toFixed(1)}%`,
    directionalAccuracy:
      m.dirAccuracy != null ? `${m.dirAccuracy.toFixed(1)}%` : "N/A",
  };
}

function storedToComparisonRows(metrics: StoredModelMetrics[]): ModelComparisonRow[] {
  if (!metrics.length) return [];
  const bestMae = Math.min(...metrics.map((m) => m.mae));
  return metrics.map((m) => ({
    model: MODEL_LABELS[m.model] ?? m.model.toUpperCase(),
    mae: m.mae.toFixed(2),
    rmse: m.rmse.toFixed(2),
    mape: `${m.mape.toFixed(1)}%`,
    notes: m.mae === bestMae ? "Best MAE" : "",
  }));
}

function catalogTemplate(ticker: string): StockAnalysis {
  const company = getPseCompanyByTicker(ticker);
  const name = company?.companyName ?? ticker.replace(/\.PS$/i, "");
  const sector = company?.sector ?? "Equity";
  const subsector = company?.subsector ?? sector;

  return {
    info: { name, ticker, sector, subsector },
    metrics: {
      lastClose: "—",
      dailyChange: "—",
      dailyChangePositive: true,
      volume: "—",
      weekRange: "—",
    },
    lastUpdated: "—",
    trend: "Mixed Signal",
    forecastTarget: "—",
    chartData: [],
    chartDomain: [0, 1],
    forecastStartDate: "",
    performance: {
      mae: "—",
      rmse: "—",
      mape: "—",
      directionalAccuracy: "—",
    },
    modelComparison: [],
    signal: null,
    entryExitPlan: null,
    companyStats: null,
    fundamentals: null,
    aiInsight: {
      summary: `${name} is listed on the Philippine Stock Exchange. Forecasts use walk-forward backtests on daily OHLCV when bar history is available.`,
      caution:
        "Insufficient or missing bar history limits indicator and forecast quality.",
      context: `Sector: ${sector}. Run ingest:bars and ingest:forecasts for live metrics.`,
    },
    marketContext: {
      disclosures: ["Check PSE EDGE for company disclosures."],
      pseiIndex: "—",
      pseiChange: "—",
      pseiPositive: true,
      sectorNote: `${sector} sector listing.`,
    },
  };
}

async function loadForecastPoints(
  symbol: string,
  ticker: string,
  model: ForecastModel,
  horizonDays: number,
  bars: MarketBar[],
  historyDays: number,
): Promise<ChartPoint[]> {
  // Precomputed DB/snapshot data was generated with CHART_HISTORY_DAYS —
  // only safe to serve it back when the caller actually wants that window.
  // A non-default historyDays (the chart's "Time Range" control) needs a
  // live regeneration to reflect it at all.
  if (historyDays === CHART_HISTORY_DAYS) {
    if (isDbMarketEnabled()) {
      const fromDb = await fetchForecastPoints(ticker, model, horizonDays);
      if (fromDb?.length) return fromDb;
    }

    const fromSnap = await getForecastFromSnapshot(symbol, model, horizonDays);
    if (fromSnap?.length) return fromSnap;
  }

  if (bars.length >= 60) {
    return generateForecast(bars, model, horizonDays, historyDays);
  }

  return barsToHistoryPoints(bars);
}

async function loadMetrics(
  symbol: string,
  ticker: string,
  horizonDays: number,
): Promise<StoredModelMetrics[]> {
  if (isDbMarketEnabled()) {
    const fromDb = await fetchModelMetrics(ticker, horizonDays);
    if (fromDb.length) return fromDb;
  }

  const snapMetrics = await getMetricsFromSnapshot(symbol, horizonDays);
  return snapMetrics.map((m) => ({
    symbol: m.symbol,
    model: m.model as ForecastModel,
    horizonDays: m.horizonDays,
    mae: m.mae,
    rmse: m.rmse,
    mape: m.mape,
    dirAccuracy: m.dirAccuracy,
    computedAt: new Date(m.computedAt),
  }));
}

export type BuildMarketAnalysisOptions = {
  model?: ForecastModel;
  horizon?: string;
  historyDays?: number;
};

export async function buildMarketAnalysis(
  ticker: string,
  quote: MarketQuote | undefined,
  bars: MarketBar[],
  options: BuildMarketAnalysisOptions = {},
): Promise<StockAnalysis | null> {
  const company = getPseCompanyByTicker(ticker);
  if (!company) return null;

  const normalized = ticker.toUpperCase().includes(".PS")
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.PS`;
  const symbol = normalized.replace(/\.PS$/i, "");
  const model = options.model ?? "linear";
  const horizonDays = options.horizon ? horizonToDays(options.horizon) : 7;
  const historyDays = options.historyDays ?? CHART_HISTORY_DAYS;

  const base = getStockAnalysisStatic(normalized) ?? catalogTemplate(normalized);
  const isIndex = base.info.sector === "Index" || symbol === "PSEI";

  const chartData = await loadForecastPoints(
    symbol,
    normalized,
    model,
    horizonDays,
    bars,
    historyDays,
  );
  const forecastStart =
    chartData.find((p) => p.forecast != null)?.date ?? base.forecastStartDate;

  const lastPrice =
    [...chartData].reverse().find((p) => p.price != null)?.price ??
    quote?.lastClose ??
    0;
  const target = forecastTargetFromPoints(chartData);

  let metrics = { ...base.metrics };
  if (quote) {
    const display = quoteToDisplay(quote, isIndex);
    metrics = {
      ...metrics,
      lastClose: display.lastClose,
      dailyChange: display.dailyChange,
      dailyChangePositive: display.direction === "up",
      volume: display.volume,
    };
    const week = weekRangeFromBars(bars);
    if (week) {
      metrics.weekRange = isIndex
        ? `${Math.round(week.low).toLocaleString("en-PH")} - ${Math.round(week.high).toLocaleString("en-PH")}`
        : `${formatPriceAmount(week.low)} - ${formatPriceAmount(week.high)}`;
    }
  }

  const storedMetrics = await loadMetrics(symbol, normalized, horizonDays);

  // The signal uses a fixed horizon so it doesn't jump when the user toggles
  // the forecast chart's horizon dropdown; reuse storedMetrics when the page
  // already asked for that horizon, otherwise fetch it separately (cached).
  const signalMetrics =
    horizonDays === SIGNAL_HORIZON_DAYS
      ? storedMetrics
      : await loadMetrics(symbol, normalized, SIGNAL_HORIZON_DAYS);
  const signal = computeTickerSignal(bars, signalMetrics, SIGNAL_HORIZON_DAYS);
  const atr14 = computeIndicators(bars).at(-1)?.atr14 ?? null;
  const { support, resistance } = computeSupportResistance(bars);
  const entryExitPlan =
    isIndex || !signal.dataSufficient
      ? null
      : computeEntryExitPlan(
          signal.action,
          lastPrice,
          atr14,
          support,
          resistance,
          consensusTargetPrice(signal.votes),
        );

  // No market-cap/shares-outstanding concept for an index.
  const companyStats = isIndex ? null : (await getCompanyStats([normalized])).get(symbol) ?? null;
  // No quarterly filer for an index either.
  const fundamentals = isIndex ? null : (await getFundamentals([normalized])).get(symbol) ?? null;

  const best = bestModelMetrics(storedMetrics);
  const performance = best
    ? metricsToPerformance(best)
    : base.performance;
  const modelComparison = storedMetrics.length
    ? storedToComparisonRows(storedMetrics)
  : base.modelComparison;

  const lastUpdated = quote
    ? formatAsOf(quote.asOf)
    : base.lastUpdated;

  const forecastTargetStr = formatTarget(target || lastPrice, isIndex);
  const trend = trendFromPrices(
    roundToDisplayPrecision(lastPrice, isIndex),
    roundToDisplayPrecision(target || lastPrice, isIndex),
  );

  // Only regenerated when there's a live quote to regenerate them from —
  // without one, base's demo-seed text is at least internally consistent
  // with itself (unlike leaving it paired with the live numbers above).
  const aiInsight = quote
    ? {
        ...base.aiInsight,
        summary: trendSummary(base.info.name, metrics.lastClose, forecastTargetStr, trend),
        caution: `Directional accuracy is ${performance.directionalAccuracy} for this ticker. Use for research only—not investment advice.`,
        context: sectorNote(base.info.sector, metrics.dailyChangePositive),
      }
    : base.aiInsight;
  const marketContext = quote
    ? {
        ...base.marketContext,
        sectorNote: sectorNote(base.info.sector, metrics.dailyChangePositive),
      }
    : base.marketContext;

  return applyOfficialLabelsToAnalysis({
    ...base,
    metrics,
    chartData,
    chartDomain: stockChartYAxisDomain(chartValuesFromPoints(chartData), {
      isIndex,
    }),
    forecastStartDate: forecastStart,
    forecastTarget: forecastTargetStr,
    trend,
    performance,
    modelComparison,
    signal: isIndex ? null : signal,
    entryExitPlan,
    companyStats,
    fundamentals,
    aiInsight,
    marketContext,
    lastUpdated,
  });
}
