import type { SignalAction } from "@/lib/signal/types";
import type { ForecastTrend } from "@/lib/types/stock";

export type WatchlistStock = {
  ticker: string;
  name: string;
  price: string;
  change: string;
  positive: boolean;
  sector: string;
  trend: ForecastTrend;
  addedDate: string;
  /** Undefined until refreshSignals() runs — pre-migration/unrefreshed rows. */
  signal?: SignalAction;
};

export const watchlistStocks: WatchlistStock[] = [
  {
    ticker: "BDO.PS",
    name: "BDO Unibank",
    price: "₱138.50",
    change: "+2.3%",
    positive: true,
    sector: "Financials",
    trend: "Projected Upward",
    addedDate: "May 10, 2026",
  },
  {
    ticker: "JFC.PS",
    name: "Jollibee Foods",
    price: "₱242.00",
    change: "+1.8%",
    positive: true,
    sector: "Consumer",
    trend: "Projected Upward",
    addedDate: "May 12, 2026",
  },
  {
    ticker: "ALI.PS",
    name: "Ayala Land",
    price: "₱32.15",
    change: "-0.5%",
    positive: false,
    sector: "Real Estate",
    trend: "Projected Downward",
    addedDate: "May 14, 2026",
  },
  {
    ticker: "SMPH.PS",
    name: "SM Prime",
    price: "₱28.90",
    change: "+1.2%",
    positive: true,
    sector: "Real Estate",
    trend: "Projected Upward",
    addedDate: "May 15, 2026",
  },
];
