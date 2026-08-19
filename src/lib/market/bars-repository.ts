import { unstable_cache } from "next/cache";

import { query } from "@/lib/db/client";
import { isDbMarketEnabled } from "@/lib/db/config";
import { tickerToSymbol } from "@/lib/market/symbol";
import type { BarRange, MarketBar } from "@/lib/market/types";
import { BAR_RANGE_DAYS } from "@/lib/market/types";

type BarRow = {
  symbol: string;
  trade_date: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

/** node-postgres parses a DATE column into a JS Date at *local* midnight —
 * reading it back via `.toISOString()` (UTC-based) shifts the calendar
 * date by a day in any timezone behind UTC (confirmed live against real
 * data: a stored "2026-08-14" round-tripped as "2026-08-13" on a UTC+8
 * machine — see also fundamentals-repository.ts, which had the same bug).
 * Local accessors (getFullYear/getMonth/getDate) reflect the correct
 * stored date regardless of system timezone; UTC accessors don't. */
function dateOnlyToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowToBar(row: BarRow): MarketBar {
  const date =
    row.trade_date instanceof Date
      ? dateOnlyToIso(row.trade_date)
      : String(row.trade_date).slice(0, 10);
  return {
    symbol: row.symbol,
    tradeDate: date,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: row.volume != null ? Number(row.volume) : null,
  };
}

export async function fetchDailyBars(
  ticker: string,
  range: BarRange,
): Promise<MarketBar[]> {
  if (!isDbMarketEnabled()) return [];

  const symbol = tickerToSymbol(ticker);
  const days = BAR_RANGE_DAYS[range];

  const rows = await query<BarRow>(
    `SELECT symbol, trade_date, open, high, low, close, volume
     FROM market_bars_daily
     WHERE symbol = $1
       AND trade_date >= CURRENT_DATE - $2::int
     ORDER BY trade_date ASC`,
    [symbol, days],
  );

  return rows.map(rowToBar);
}

export async function getDailyBars(
  ticker: string,
  range: BarRange,
): Promise<MarketBar[]> {
  if (!isDbMarketEnabled()) return [];

  const symbol = tickerToSymbol(ticker);
  return unstable_cache(
    () => fetchDailyBars(ticker, range),
    ["market-bars", symbol, range],
    { revalidate: 300, tags: [`market-bars:${symbol}`] },
  )();
}

export function weekRangeFromBars(bars: MarketBar[]): {
  low: number;
  high: number;
} | null {
  if (bars.length === 0) return null;
  const recent = bars.slice(-5);
  const lows = recent.map((b) => b.low);
  const highs = recent.map((b) => b.high);
  return { low: Math.min(...lows), high: Math.max(...highs) };
}
