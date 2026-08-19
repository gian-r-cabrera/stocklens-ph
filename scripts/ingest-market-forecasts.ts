/**
 * Baseline forecast + walk-forward metrics ingest → market_forecasts_latest / market_model_metrics
 * Run: npm run ingest:forecasts
 * Flags: --write-snapshot, --probe=BDO, --seeds, --verbose
 */
import "dotenv/config";
import { join } from "node:path";

import { walkForwardBacktest, bestModelMetrics } from "../src/lib/forecast/backtest";
import { generateForecast } from "../src/lib/forecast/generate";
import {
  BASELINE_MODELS,
  FORECAST_HORIZONS,
  type ForecastModel,
} from "../src/lib/forecast/types";
import { ALL_STOCK_SEEDS } from "../src/lib/data/stock-seeds";
import { closeIngestPool, getIngestPool } from "./lib/db-ingest";
import { assertValidDatabaseUrl, loadMarketEnv } from "./lib/load-market-env";
import { loadIngestSymbols } from "./lib/universe-symbols";

const MIN_BARS = 60;
const BAR_LOOKBACK = 400;
const MIN_SNAPSHOT_FORECASTS = 200;

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
 * a day in any timezone behind UTC; local accessors don't. This affects
 * more than display here: the shifted date gets stored verbatim as each
 * forecast ChartPoint's `date` field in market_forecasts_latest. */
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

async function upsertForecast(
  symbol: string,
  model: ForecastModel,
  horizonDays: number,
  points: unknown,
): Promise<void> {
  const pool = getIngestPool();
  await pool.query(
    `INSERT INTO market_forecasts_latest (symbol, model, horizon_days, generated_at, points)
     VALUES ($1, $2, $3, NOW(), $4::jsonb)
     ON CONFLICT (symbol, model, horizon_days) DO UPDATE SET
       generated_at = EXCLUDED.generated_at,
       points = EXCLUDED.points`,
    [symbol, model, horizonDays, JSON.stringify(points)],
  );
}

async function upsertMetrics(
  symbol: string,
  model: ForecastModel,
  horizonDays: number,
  mae: number,
  rmse: number,
  mape: number,
  dirAccuracy: number | null,
): Promise<void> {
  const pool = getIngestPool();
  await pool.query(
    `INSERT INTO market_model_metrics
       (symbol, model, horizon_days, mae, rmse, mape, dir_accuracy, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (symbol, model, horizon_days) DO UPDATE SET
       mae = EXCLUDED.mae,
       rmse = EXCLUDED.rmse,
       mape = EXCLUDED.mape,
       dir_accuracy = EXCLUDED.dir_accuracy,
       computed_at = EXCLUDED.computed_at`,
    [symbol, model, horizonDays, mae, rmse, mape, dirAccuracy],
  );
}

async function runLstmForSymbol(
  symbol: string,
  bars: Awaited<ReturnType<typeof fetchBarsForSymbol>>,
): Promise<void> {
  const { spawnSync } = await import("node:child_process");
  const closes = bars.map((b) => b.close);
  const script = join(process.cwd(), "services/forecast/forecast/lstm.py");
  const result = spawnSync(
    "python3",
    [script, "--closes", JSON.stringify(closes), "--horizon", "7"],
    { encoding: "utf8", timeout: 120_000 },
  );

  if (result.status !== 0) {
    console.warn(`  [lstm] ${symbol}: ${result.stderr || "failed"}`);
    return;
  }

  try {
    const payload = JSON.parse(result.stdout) as {
      horizon7: number[];
      horizon30: number[];
      mae: number;
      rmse: number;
      mape: number;
      dirAccuracy: number | null;
    };

    for (const horizonDays of FORECAST_HORIZONS) {
      const prices =
        horizonDays === 7 ? payload.horizon7 : payload.horizon30;
      const points = generateForecast(bars, "lstm", horizonDays);
      const lastHist = points.filter((p) => p.price != null).length;
      for (let i = 0; i < prices.length; i++) {
        const idx = lastHist + i;
        if (points[idx]) points[idx]!.forecast = prices[i]!;
      }
      await upsertForecast(symbol, "lstm", horizonDays, points);
      await upsertMetrics(
        symbol,
        "lstm",
        horizonDays,
        payload.mae,
        payload.rmse,
        payload.mape,
        payload.dirAccuracy,
      );
    }
    console.log(`  [lstm] ${symbol}: OK`);
  } catch (err) {
    console.warn(`  [lstm] ${symbol}: parse error`, err);
  }
}

async function main(): Promise<void> {
  loadMarketEnv();
  assertValidDatabaseUrl();

  const verbose = process.argv.includes("--verbose");
  const writeSnapshot = process.argv.includes("--write-snapshot");
  const runLstm = process.argv.includes("--lstm");
  const seedsOnly = process.argv.includes("--seeds");
  const probe = parseProbeSymbol();
  const concurrency = parseConcurrency();

  // --seeds scopes to the ~30 demo/blue-chip tickers used for dashboard and
  // watchlist seed data. Baseline models (naive/ma/linear) run near-instant
  // JS math, so routine runs process the full universe by default — the
  // forecasts page and individual stock pages already show live data for
  // any symbol with published forecast rows, not just this seed set.
  // --seeds only matters for --lstm: each symbol spawns a python3
  // subprocess (up to 120s), so a full ~250+ symbol universe run isn't a
  // fit for a routine CI job.
  const symbols = probe
    ? [probe]
    : seedsOnly
      ? ALL_STOCK_SEEDS.map((s) => s.ticker.replace(/\.PS$/i, "").toUpperCase())
      : loadIngestSymbols();

  console.log(
    `Computing forecasts for ${symbols.length} symbol(s) (concurrency ${concurrency})...`,
  );

  const snapshotForecasts: Array<{
    symbol: string;
    model: string;
    horizonDays: number;
    generatedAt: string;
    points: unknown;
  }> = [];
  const snapshotMetrics: Array<{
    symbol: string;
    model: string;
    horizonDays: number;
    mae: number;
    rmse: number;
    mape: number;
    dirAccuracy: number | null;
    computedAt: string;
  }> = [];

  let processed = 0;
  let skipped = 0;

  await mapPool(symbols, concurrency, async (symbol) => {
    const bars = await fetchBarsForSymbol(symbol);
    if (bars.length < MIN_BARS) {
      skipped++;
      if (verbose) console.log(`  ${symbol}: skip (${bars.length} bars)`);
      return;
    }

    let horizon7Metrics: ReturnType<typeof walkForwardBacktest> = [];

    for (const horizonDays of FORECAST_HORIZONS) {
      const metrics = walkForwardBacktest(bars, horizonDays);
      if (horizonDays === 7) horizon7Metrics = metrics;

      for (const m of metrics) {
        await upsertMetrics(
          symbol,
          m.model,
          horizonDays,
          m.mae,
          m.rmse,
          m.mape,
          m.dirAccuracy,
        );
        snapshotMetrics.push({
          symbol,
          model: m.model,
          horizonDays,
          mae: m.mae,
          rmse: m.rmse,
          mape: m.mape,
          dirAccuracy: m.dirAccuracy,
          computedAt: new Date().toISOString(),
        });
      }

      for (const model of BASELINE_MODELS) {
        const points = generateForecast(bars, model, horizonDays);
        await upsertForecast(symbol, model, horizonDays, points);
        snapshotForecasts.push({
          symbol,
          model,
          horizonDays,
          generatedAt: new Date().toISOString(),
          points,
        });
      }
    }

    if (runLstm) {
      await runLstmForSymbol(symbol, bars);
    }

    processed++;
    const best = bestModelMetrics(horizon7Metrics);
    console.log(
      `  ${symbol}: OK (${bars.length} bars, best=${best?.model ?? "n/a"}) (${processed}/${symbols.length})`,
    );
  });

  console.log(`Done. Processed ${processed}, skipped ${skipped} (insufficient bars).`);

  if (writeSnapshot) {
    if (snapshotForecasts.length < MIN_SNAPSHOT_FORECASTS) {
      console.error(
        `Refusing to publish snapshot: only ${snapshotForecasts.length} forecast rows (expected >= ${MIN_SNAPSHOT_FORECASTS}).`,
      );
      await closeIngestPool();
      process.exit(1);
    }

    const baseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to publish the forecasts snapshot.",
      );
    }

    const res = await fetch(
      `${baseUrl}/storage/v1/object/market-data/market-forecasts-snapshot.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "x-upsert": "true",
        },
        body: JSON.stringify({
          asOf: new Date().toISOString(),
          forecasts: snapshotForecasts,
          metrics: snapshotMetrics,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to publish snapshot: HTTP ${res.status} ${body}`);
    }

    console.log(
      `Published snapshot to Supabase Storage (${snapshotForecasts.length} forecast rows).`,
    );
  }

  await closeIngestPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
