import { unstable_cache } from "next/cache";

import { query } from "@/lib/db/client";
import { isDbMarketEnabled } from "@/lib/db/config";
import type { Fundamentals } from "@/lib/market/types";
import { tickerToSymbol } from "@/lib/market/symbol";

type FundamentalsRow = {
  symbol: string;
  period_ended: Date;
  total_assets: string | null;
  total_liabilities: string | null;
  stockholders_equity: string | null;
  book_value_per_share: string | null;
  gross_revenue_ytd: string | null;
  net_income_ytd: string | null;
  eps_basic_ttm: string | null;
  eps_diluted_ttm: string | null;
  dividend_per_share_ttm: string | null;
  as_of: Date;
};

/** node-postgres parses a DATE column into a JS Date at *local* midnight —
 * reading it back via `.toISOString()` (UTC-based) shifts the calendar
 * date by a day in any timezone behind UTC (confirmed live: a stored
 * "2026-06-30" round-tripped as "2026-06-29" on a UTC+8 machine). Local
 * accessors (getFullYear/getMonth/getDate) reflect the correct stored
 * date regardless of system timezone; UTC accessors don't. */
function dateOnlyToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowToFundamentals(row: FundamentalsRow): Fundamentals {
  return {
    symbol: row.symbol,
    periodEnded:
      row.period_ended instanceof Date
        ? dateOnlyToIso(row.period_ended)
        : String(row.period_ended).slice(0, 10),
    totalAssets: row.total_assets != null ? Number(row.total_assets) : null,
    totalLiabilities: row.total_liabilities != null ? Number(row.total_liabilities) : null,
    stockholdersEquity:
      row.stockholders_equity != null ? Number(row.stockholders_equity) : null,
    bookValuePerShare:
      row.book_value_per_share != null ? Number(row.book_value_per_share) : null,
    grossRevenueYtd: row.gross_revenue_ytd != null ? Number(row.gross_revenue_ytd) : null,
    netIncomeYtd: row.net_income_ytd != null ? Number(row.net_income_ytd) : null,
    epsBasicTtm: row.eps_basic_ttm != null ? Number(row.eps_basic_ttm) : null,
    epsDilutedTtm: row.eps_diluted_ttm != null ? Number(row.eps_diluted_ttm) : null,
    dividendPerShareTtm:
      row.dividend_per_share_ttm != null ? Number(row.dividend_per_share_ttm) : null,
    asOf: new Date(row.as_of),
  };
}

export async function fetchFundamentals(symbols?: string[]): Promise<Map<string, Fundamentals>> {
  if (!isDbMarketEnabled()) {
    return new Map();
  }

  const normalized = symbols?.map((s) => tickerToSymbol(s)).filter(Boolean) ?? [];

  const rows =
    normalized.length > 0
      ? await query<FundamentalsRow>(
          `SELECT symbol, period_ended, total_assets, total_liabilities, stockholders_equity,
                  book_value_per_share, gross_revenue_ytd, net_income_ytd, eps_basic_ttm,
                  eps_diluted_ttm, dividend_per_share_ttm, as_of
           FROM fundamentals_latest
           WHERE symbol = ANY($1::text[])`,
          [normalized],
        )
      : await query<FundamentalsRow>(
          `SELECT symbol, period_ended, total_assets, total_liabilities, stockholders_equity,
                  book_value_per_share, gross_revenue_ytd, net_income_ytd, eps_basic_ttm,
                  eps_diluted_ttm, dividend_per_share_ttm, as_of
           FROM fundamentals_latest`,
        );

  const map = new Map<string, Fundamentals>();
  for (const row of rows) {
    map.set(row.symbol, rowToFundamentals(row));
  }
  return map;
}

/** JSON-safe shape for unstable_cache — it deserializes a Map to a plain
 * object (and Dates to strings), so the cached value must round-trip
 * through a serializable shape rather than caching the Map directly (same
 * pattern as company-stats-repository.ts). */
type CachedFundamentalsEntry = Omit<Fundamentals, "asOf"> & { asOf: string };

export async function getFundamentals(symbols?: string[]): Promise<Map<string, Fundamentals>> {
  if (!isDbMarketEnabled()) {
    return new Map();
  }

  const cacheKey = symbols?.map(tickerToSymbol).sort().join(",") ?? "all";
  const entries = await unstable_cache(
    async (): Promise<CachedFundamentalsEntry[]> => {
      const map = await fetchFundamentals(symbols);
      return Array.from(map.values()).map((f) => ({ ...f, asOf: f.asOf.toISOString() }));
    },
    ["fundamentals", cacheKey],
    { revalidate: 3600, tags: ["fundamentals"] },
  )();

  const map = new Map<string, Fundamentals>();
  for (const entry of entries) {
    map.set(entry.symbol, { ...entry, asOf: new Date(entry.asOf) });
  }
  return map;
}
