/**
 * Point-in-time backtest of the consensus Buy/Hold/Avoid signal across the
 * full symbol universe (not just a 4-6 stock watchlist) — the in-app
 * Signal Backtest card on /watchlist runs the same underlying function
 * (`backtestConsensusSignal`) but only over whatever's currently on your
 * watchlist, which is too small a sample to tell a real edge apart from
 * noise. This gives the same read at a scale worth trusting before tuning
 * any thresholds.
 *
 * Run: npm run backtest:signal
 * Flags: --verbose, --seeds, --probe=BDO, --concurrency=N
 */
import "dotenv/config";

import { aggregateTrials, backtestConsensusSignal } from "../src/lib/signal/backtest";
import { SIGNAL_HORIZON_DAYS } from "../src/lib/signal/consensus";
import type { SignalBacktestTrial } from "../src/lib/signal/backtest";
import { ALL_STOCK_SEEDS } from "../src/lib/data/stock-seeds";
import { closeIngestPool, getIngestPool } from "./lib/db-ingest";
import { assertValidDatabaseUrl, loadMarketEnv } from "./lib/load-market-env";
import { loadIngestSymbols } from "./lib/universe-symbols";

const MIN_BARS = 60;
const BAR_LOOKBACK = 400;

type BarRow = {
  symbol: string;
  trade_date: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

function parseProbeSymbol(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--probe="));
  if (!arg) return null;
  return arg.split("=")[1]?.trim().toUpperCase() ?? null;
}

function parseConcurrency(): number {
  const arg = process.argv.find((a) => a.startsWith("--concurrency="));
  const n = arg ? Number(arg.split("=")[1]) : 4;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 5) : 4;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

/** Same fix as src/lib/market/bars-repository.ts's dateOnlyToIso — see that
 * file's comment. node-postgres's `.toISOString()` shifts DATE columns by
 * a day in any timezone behind UTC; local accessors don't. */
function dateOnlyToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchBarsForSymbol(symbol: string) {
  const pool = getIngestPool();
  const rows = await pool.query<BarRow>(
    `SELECT symbol, trade_date, open, high, low, close, volume
     FROM market_bars_daily
     WHERE symbol = $1
     ORDER BY trade_date DESC
     LIMIT $2`,
    [symbol, BAR_LOOKBACK],
  );

  return rows.rows
    .map((row) => ({
      symbol: row.symbol,
      tradeDate:
        row.trade_date instanceof Date
          ? dateOnlyToIso(row.trade_date)
          : String(row.trade_date).slice(0, 10),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: row.volume != null ? Number(row.volume) : null,
    }))
    .reverse();
}

function printReport(allTrials: SignalBacktestTrial[]): void {
  const { byAction, baselineAvgReturnPct } = aggregateTrials(allTrials);

  console.log("\n=== Signal Backtest Report ===");
  console.log(`Total trials: ${allTrials.length}`);
  console.log(
    `Baseline (any day, any signal) avg forward return: ${
      baselineAvgReturnPct != null ? baselineAvgReturnPct.toFixed(2) : "n/a"
    }%\n`,
  );

  for (const action of ["buy", "hold", "avoid"] as const) {
    const stats = byAction[action];
    console.log(
      `  ${action.toUpperCase().padEnd(6)} count=${String(stats.count).padEnd(5)} ` +
        `hitRate=${stats.hitRate != null ? `${stats.hitRate.toFixed(1)}%` : "n/a"}`.padEnd(28) +
        `avgReturn=${stats.avgReturnPct != null ? `${stats.avgReturnPct.toFixed(2)}%` : "n/a"}`,
    );
  }

  const buy = byAction.buy;
  if (buy.count > 0 && baselineAvgReturnPct != null && buy.avgReturnPct != null) {
    const edge = buy.avgReturnPct - baselineAvgReturnPct;
    console.log(
      `\nBuy edge vs baseline: ${edge >= 0 ? "+" : ""}${edge.toFixed(2)}pp` +
        (edge > 0 ? " (signal beat doing nothing)" : " (signal did not beat doing nothing)"),
    );
  }
}

async function main(): Promise<void> {
  loadMarketEnv();
  assertValidDatabaseUrl();

  const verbose = process.argv.includes("--verbose");
  const seedsOnly = process.argv.includes("--seeds");
  const probe = parseProbeSymbol();
  const concurrency = parseConcurrency();

  const symbols = probe
    ? [probe]
    : seedsOnly
      ? ALL_STOCK_SEEDS.map((s) => s.ticker.replace(/\.PS$/i, "").toUpperCase())
      : loadIngestSymbols();

  console.log(
    `Backtesting the consensus signal for ${symbols.length} symbol(s) at a ${SIGNAL_HORIZON_DAYS}-day horizon (concurrency ${concurrency})...`,
  );

  let processed = 0;
  let skipped = 0;
  const allTrials: SignalBacktestTrial[] = [];

  await mapPool(symbols, concurrency, async (symbol) => {
    const bars = await fetchBarsForSymbol(symbol);
    if (bars.length < MIN_BARS) {
      skipped++;
      if (verbose) console.log(`  ${symbol}: skip (${bars.length} bars)`);
      return;
    }

    const result = backtestConsensusSignal(bars, SIGNAL_HORIZON_DAYS);
    if (result.trials.length === 0) {
      skipped++;
      if (verbose) console.log(`  ${symbol}: skip (0 usable trials)`);
      return;
    }

    allTrials.push(...result.trials);
    processed++;
    if (verbose) {
      console.log(
        `  ${symbol}: OK (${result.trials.length} trials) (${processed}/${symbols.length})`,
      );
    }
  });

  console.log(`Done. Processed ${processed}, skipped ${skipped} (insufficient bars).`);
  printReport(allTrials);

  await closeIngestPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
