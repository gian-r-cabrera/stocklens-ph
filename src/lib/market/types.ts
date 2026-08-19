export type MarketQuote = {
  symbol: string;
  lastClose: number;
  changePct: number;
  changeAbs: number | null;
  volume: number | null;
  asOf: Date;
  source: string;
};

export type MarketBar = {
  symbol: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

/** Company-size/liquidity reference stats from PSE EDGE — not P/E-style
 * fundamentals (no EPS/revenue/dividend data here; that needs disclosure-PDF
 * parsing, a separate unbuilt project). */
export type CompanyStats = {
  symbol: string;
  marketCap: number | null;
  outstandingShares: number | null;
  freeFloatPct: number | null;
  foreignOwnershipLimitPct: number | null;
  parValue: number | null;
  asOf: Date;
};

/** Real per-filing fundamentals from the latest SEC Form 17-Q (quarterly
 * report) cover sheet PSE EDGE renders as structured HTML — Total Assets/
 * Liabilities, Stockholders' Equity, Book Value/Share, Revenue and Net
 * Income (year-to-date), and EPS (trailing 12 months, basic/diluted).
 * P/E and P/B aren't stored here — they depend on the *current* price,
 * which changes far more often than a quarterly filing, so they're
 * computed at render time instead of ever going stale in the DB. */
export type Fundamentals = {
  symbol: string;
  periodEnded: string;
  totalAssets: number | null;
  totalLiabilities: number | null;
  stockholdersEquity: number | null;
  bookValuePerShare: number | null;
  grossRevenueYtd: number | null;
  netIncomeYtd: number | null;
  epsBasicTtm: number | null;
  epsDilutedTtm: number | null;
  /** Sum of COMMON/Cash dividend rates with an ex-dividend date in the
   * trailing 12 months, from PSE EDGE's Dividends and Rights page — null
   * when the company paid no cash dividend in that window (not the same
   * as "unknown"; both currently render as "—" in the UI). */
  dividendPerShareTtm: number | null;
  asOf: Date;
};

export type BarRange = "7d" | "30d" | "90d" | "1y";

export const BAR_RANGE_DAYS: Record<BarRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

import type { PriceDirection } from "@/lib/market/change-direction";

export type QuoteDisplay = {
  lastClose: string;
  dailyChange: string;
  direction: PriceDirection;
  /** @deprecated Use `direction`; true only when direction is `"up"`. */
  positive: boolean;
  volume: string;
};
