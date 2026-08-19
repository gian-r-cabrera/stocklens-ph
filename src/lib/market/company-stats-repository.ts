import { unstable_cache } from "next/cache";

import { query } from "@/lib/db/client";
import { isDbMarketEnabled } from "@/lib/db/config";
import type { CompanyStats } from "@/lib/market/types";
import { tickerToSymbol } from "@/lib/market/symbol";

type CompanyStatsRow = {
  symbol: string;
  market_cap: string | null;
  outstanding_shares: string | null;
  free_float_pct: string | null;
  foreign_ownership_limit_pct: string | null;
  par_value: string | null;
  as_of: Date;
};

function rowToCompanyStats(row: CompanyStatsRow): CompanyStats {
  return {
    symbol: row.symbol,
    marketCap: row.market_cap != null ? Number(row.market_cap) : null,
    outstandingShares: row.outstanding_shares != null ? Number(row.outstanding_shares) : null,
    freeFloatPct: row.free_float_pct != null ? Number(row.free_float_pct) : null,
    foreignOwnershipLimitPct:
      row.foreign_ownership_limit_pct != null ? Number(row.foreign_ownership_limit_pct) : null,
    parValue: row.par_value != null ? Number(row.par_value) : null,
    asOf: new Date(row.as_of),
  };
}

export async function fetchCompanyStats(
  symbols?: string[],
): Promise<Map<string, CompanyStats>> {
  if (!isDbMarketEnabled()) {
    return new Map();
  }

  const normalized = symbols?.map((s) => tickerToSymbol(s)).filter(Boolean) ?? [];

  const rows =
    normalized.length > 0
      ? await query<CompanyStatsRow>(
          `SELECT symbol, market_cap, outstanding_shares, free_float_pct, foreign_ownership_limit_pct, par_value, as_of
           FROM company_stats_latest
           WHERE symbol = ANY($1::text[])`,
          [normalized],
        )
      : await query<CompanyStatsRow>(
          `SELECT symbol, market_cap, outstanding_shares, free_float_pct, foreign_ownership_limit_pct, par_value, as_of
           FROM company_stats_latest`,
        );

  const map = new Map<string, CompanyStats>();
  for (const row of rows) {
    map.set(row.symbol, rowToCompanyStats(row));
  }
  return map;
}

/** JSON-safe shape for unstable_cache — it deserializes a Map to a plain
 * object (and Dates to strings), so the cached value must round-trip
 * through a serializable shape rather than caching the Map directly (same
 * pattern as quotes-map.ts's CachedQuoteEntry). */
type CachedCompanyStatsEntry = Omit<CompanyStats, "asOf"> & { asOf: string };

export async function getCompanyStats(symbols?: string[]): Promise<Map<string, CompanyStats>> {
  if (!isDbMarketEnabled()) {
    return new Map();
  }

  const cacheKey = symbols?.map(tickerToSymbol).sort().join(",") ?? "all";
  const entries = await unstable_cache(
    async (): Promise<CachedCompanyStatsEntry[]> => {
      const map = await fetchCompanyStats(symbols);
      return Array.from(map.values()).map((s) => ({ ...s, asOf: s.asOf.toISOString() }));
    },
    ["company-stats", cacheKey],
    { revalidate: 3600, tags: ["company-stats"] },
  )();

  const map = new Map<string, CompanyStats>();
  for (const entry of entries) {
    map.set(entry.symbol, { ...entry, asOf: new Date(entry.asOf) });
  }
  return map;
}
