/**
 * PSE EDGE mobile API — same stockdataList endpoint pse-edge-quotes.ts
 * already calls for prices, but reading the company-size/liquidity fields
 * (market cap, shares outstanding, free float, foreign limit) that row
 * already carries and the quotes path ignores. Company-stats-only ingest:
 * this data moves slowly, so it's a separate occasional script rather than
 * folded into the high-frequency quotes refresh.
 */
import type { CompanyStats } from "../../src/lib/market/types";

const EDGE_STOCK_DATA_URL =
  "https://edge.pse.com.ph/mobile/com.pse.ctrl.companyinformation.krx?method=stockdataList";

const USER_AGENT = "StockLensPH-ingest/1.0 (educational; PSE EDGE company stats)";

export type EdgeStatsInput = {
  symbol: string;
  companyId: string;
};

type EdgeStatsRow = {
  SYMBOL?: string;
  MARKET_CAPITALIZATION?: number;
  OUTSTANDING_SHARES?: number;
  FREE_FLOAT_LEVEL?: number;
  FOREIGN_LIMIT?: number;
  PAR_VALUE?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function rowToCompanyStats(row: EdgeStatsRow, symbol: string): CompanyStats | null {
  const hasAnyStat =
    row.MARKET_CAPITALIZATION != null ||
    row.OUTSTANDING_SHARES != null ||
    row.FREE_FLOAT_LEVEL != null ||
    row.FOREIGN_LIMIT != null ||
    row.PAR_VALUE != null;
  if (!hasAnyStat) return null;

  return {
    symbol: symbol.toUpperCase(),
    marketCap: row.MARKET_CAPITALIZATION ?? null,
    outstandingShares: row.OUTSTANDING_SHARES ?? null,
    freeFloatPct: row.FREE_FLOAT_LEVEL ?? null,
    foreignOwnershipLimitPct: row.FOREIGN_LIMIT ?? null,
    parValue: row.PAR_VALUE ?? null,
    asOf: new Date(),
  };
}

export async function fetchPseEdgeCompanyStats(
  companyId: string,
  symbol: string,
  delayMs = 50,
): Promise<CompanyStats | null> {
  const body = new URLSearchParams({
    company_id: companyId,
    isApp: "N",
  });

  const res = await fetch(EDGE_STOCK_DATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
  });

  if (delayMs > 0) await sleep(delayMs);

  if (!res.ok) return null;

  const json = (await res.json()) as { list?: EdgeStatsRow[] };
  const row = json.list?.[0];
  if (!row) return null;

  return rowToCompanyStats(row, row.SYMBOL ?? symbol);
}

export async function fetchPseEdgeCompanyStatsList(
  inputs: EdgeStatsInput[],
  options?: {
    delayMs?: number;
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<CompanyStats[]> {
  const delayMs = options?.delayMs ?? 50;
  const concurrency = options?.concurrency ?? 10;
  let completed = 0;

  const results = await mapPool(inputs, concurrency, async (input) => {
    const stats = await fetchPseEdgeCompanyStats(input.companyId, input.symbol, delayMs);
    completed++;
    options?.onProgress?.(completed, inputs.length);
    return stats;
  });

  return results.filter((s): s is CompanyStats => s != null);
}
