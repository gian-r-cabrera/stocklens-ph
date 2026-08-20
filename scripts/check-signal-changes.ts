/**
 * Checks the consensus Buy/Hold/Avoid signal for a manually-maintained
 * ticker list (data/notify-watchlist.json) against the last-known signal
 * per ticker (data/notify-signal-state.json), and reports which ones
 * changed. Meant to run on a schedule (.github/workflows/signal-notify.yml)
 * so a signal flip files a GitHub issue instead of only showing up next
 * time you happen to open the app.
 *
 * The in-app watchlist lives only in the browser's localStorage — nothing
 * server-side (this script included) can read it — so the ticker list here
 * is a separate, manually-maintained file, not a live sync.
 *
 * Run: npm run check:signal-changes
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { computeTickerSignal, SIGNAL_HORIZON_DAYS } from "../src/lib/signal/consensus";
import type { SignalAction } from "../src/lib/signal/types";
import type { BaselineModel, ForecastModel } from "../src/lib/forecast/types";
import type { MarketBar } from "../src/lib/market/types";
import { closeIngestPool, getIngestPool } from "./lib/db-ingest";
import { assertValidDatabaseUrl, loadMarketEnv } from "./lib/load-market-env";

const WATCHLIST_PATH = "data/notify-watchlist.json";
const STATE_PATH = "data/notify-signal-state.json";
const BAR_LOOKBACK = 200;

type SignalState = Record<string, { action: SignalAction; confidence: number; asOf: string }>;

function tickerToSymbol(ticker: string): string {
  return ticker.toUpperCase().replace(/\.PS$/i, "");
}

/** Same fix as bars-repository.ts's dateOnlyToIso — node-postgres shifts
 * DATE columns by a day in timezones behind UTC via .toISOString(). */
function dateOnlyToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadWatchlist(): string[] {
  const raw = JSON.parse(readFileSync(WATCHLIST_PATH, "utf-8")) as { tickers: string[] };
  return raw.tickers;
}

function loadState(): SignalState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8")) as SignalState;
  } catch {
    return {};
  }
}

async function fetchBars(symbol: string): Promise<MarketBar[]> {
  const pool = getIngestPool();
  const rows = await pool.query<{
    trade_date: Date;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string | null;
  }>(
    `SELECT trade_date, open, high, low, close, volume
     FROM market_bars_daily
     WHERE symbol = $1
     ORDER BY trade_date DESC
     LIMIT $2`,
    [symbol, BAR_LOOKBACK],
  );
  return rows.rows
    .map((row) => ({
      symbol,
      tradeDate: dateOnlyToIso(row.trade_date),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: row.volume != null ? Number(row.volume) : null,
    }))
    .reverse();
}

async function fetchMetrics(
  symbol: string,
): Promise<{ model: ForecastModel; dirAccuracy: number | null }[]> {
  const pool = getIngestPool();
  const rows = await pool.query<{ model: BaselineModel; dir_accuracy: string | null }>(
    `SELECT model, dir_accuracy
     FROM market_model_metrics
     WHERE symbol = $1 AND horizon_days = $2`,
    [symbol, SIGNAL_HORIZON_DAYS],
  );
  return rows.rows.map((row) => ({
    model: row.model,
    dirAccuracy: row.dir_accuracy != null ? Number(row.dir_accuracy) : null,
  }));
}

/** Writes to $GITHUB_OUTPUT in the multi-line-safe format GitHub Actions
 * expects, when running in CI. No-op locally. */
function writeGithubOutput(name: string, value: string): void {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) return;
  const delimiter = `EOF_${Date.now()}`;
  writeFileSync(outFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, { flag: "a" });
}

async function main(): Promise<void> {
  loadMarketEnv();
  assertValidDatabaseUrl();

  const tickers = loadWatchlist();
  const prevState = loadState();
  const nextState: SignalState = { ...prevState };
  const changes: string[] = [];

  console.log(`Checking signal for ${tickers.length} ticker(s)...`);

  for (const ticker of tickers) {
    const symbol = tickerToSymbol(ticker);
    const [bars, metrics] = await Promise.all([fetchBars(symbol), fetchMetrics(symbol)]);
    const signal = computeTickerSignal(bars, metrics, SIGNAL_HORIZON_DAYS);

    if (!signal.dataSufficient) {
      console.log(`  ${ticker}: skip (insufficient data)`);
      continue;
    }

    const prev = prevState[ticker];
    const asOf = new Date().toISOString().slice(0, 10);
    nextState[ticker] = { action: signal.action, confidence: signal.confidence, asOf };

    if (!prev) {
      console.log(`  ${ticker}: first check — ${signal.action} (${signal.confidence}%)`);
      changes.push(
        `- **${ticker}**: first tracked signal — **${signal.action.toUpperCase()}** (${signal.confidence}% confidence)`,
      );
    } else if (prev.action !== signal.action) {
      console.log(
        `  ${ticker}: CHANGED ${prev.action} -> ${signal.action} (${signal.confidence}%)`,
      );
      changes.push(
        `- **${ticker}**: ${prev.action.toUpperCase()} → **${signal.action.toUpperCase()}** (${signal.confidence}% confidence, as of ${prev.asOf} → ${asOf})`,
      );
    } else {
      console.log(`  ${ticker}: unchanged (${signal.action})`);
    }
  }

  writeFileSync(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`);

  const hasChanges = changes.length > 0;
  writeGithubOutput("has_changes", String(hasChanges));
  if (hasChanges) {
    writeGithubOutput("summary", changes.join("\n"));
  }

  console.log(hasChanges ? `\n${changes.length} change(s) detected.` : "\nNo signal changes.");

  await closeIngestPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
