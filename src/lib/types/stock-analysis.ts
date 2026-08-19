import type { CompanyStats, Fundamentals } from "@/lib/market/types";
import type { ConsensusSignal, EntryExitPlan } from "@/lib/signal/types";
import type { ForecastTrend } from "@/lib/types/stock";

export type StockInfo = {
  name: string;
  ticker: string;
  sector: string;
  subsector: string;
};

export type StockMetrics = {
  lastClose: string;
  dailyChange: string;
  dailyChangePositive: boolean;
  volume: string;
  weekRange: string;
};

export type ChartPoint = {
  date: string;
  price: number | null;
  forecast: number | null;
};

export type ModelComparisonRow = {
  model: string;
  mae: string;
  rmse: string;
  mape: string;
  notes: string;
};

export type PerformanceMetrics = {
  mae: string;
  rmse: string;
  mape: string;
  directionalAccuracy: string;
};

export type StockAnalysis = {
  info: StockInfo;
  metrics: StockMetrics;
  lastUpdated: string;
  trend: ForecastTrend;
  forecastTarget: string;
  chartData: ChartPoint[];
  chartDomain: [number, number];
  forecastStartDate: string;
  performance: PerformanceMetrics;
  modelComparison: ModelComparisonRow[];
  signal: ConsensusSignal | null;
  entryExitPlan: EntryExitPlan | null;
  companyStats: CompanyStats | null;
  fundamentals: Fundamentals | null;
  aiInsight: {
    summary: string;
    caution: string;
    context: string;
  };
  marketContext: {
    disclosures: string[];
    pseiIndex: string;
    pseiChange: string;
    pseiPositive: boolean;
    sectorNote: string;
  };
};
