/**
 * Real fundamentals ingest → fundamentals_latest
 * Run: npm run ingest:fundamentals
 * Manual/occasional job, not a scheduled cron — quarterly filings don't
 * need one, and this is a 3-request-per-company chain (~283 companies),
 * not something to run on a schedule casually.
 * Flags: --symbols=BDO,JFC,... (allow-list), --verbose
 */
import "dotenv/config";

import { closeIngestPool, getIngestPool } from "./lib/db-ingest";
import { assertValidDatabaseUrl, loadMarketEnv } from "./lib/load-market-env";
import {
  fetchFundamentalsList,
  type FundamentalsInput,
} from "./market/pse-edge-fundamentals";
import { loadCompanyIdBySymbol, loadIngestSymbols } from "./lib/universe-symbols";
import type { Fundamentals } from "../src/lib/market/types";

function parseSymbolsFilter(argv: string[]): Set<string> | null {
  const arg = argv.find((a) => a.startsWith("--symbols="));
  if (!arg) return null;
  return new Set(
    arg
      .split("=")[1]!
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

async function upsertFundamentals(rows: Fundamentals[]): Promise<number> {
  const pool = getIngestPool();
  let written = 0;

  for (const f of rows) {
    await pool.query(
      `INSERT INTO fundamentals_latest
         (symbol, period_ended, total_assets, total_liabilities, stockholders_equity,
          book_value_per_share, gross_revenue_ytd, net_income_ytd, eps_basic_ttm,
          eps_diluted_ttm, dividend_per_share_ttm, as_of)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (symbol) DO UPDATE SET
         period_ended = EXCLUDED.period_ended,
         total_assets = EXCLUDED.total_assets,
         total_liabilities = EXCLUDED.total_liabilities,
         stockholders_equity = EXCLUDED.stockholders_equity,
         book_value_per_share = EXCLUDED.book_value_per_share,
         gross_revenue_ytd = EXCLUDED.gross_revenue_ytd,
         net_income_ytd = EXCLUDED.net_income_ytd,
         eps_basic_ttm = EXCLUDED.eps_basic_ttm,
         eps_diluted_ttm = EXCLUDED.eps_diluted_ttm,
         dividend_per_share_ttm = EXCLUDED.dividend_per_share_ttm,
         as_of = EXCLUDED.as_of`,
      [
        f.symbol,
        f.periodEnded,
        f.totalAssets,
        f.totalLiabilities,
        f.stockholdersEquity,
        f.bookValuePerShare,
        f.grossRevenueYtd,
        f.netIncomeYtd,
        f.epsBasicTtm,
        f.epsDilutedTtm,
        f.dividendPerShareTtm,
        f.asOf.toISOString(),
      ],
    );
    written++;
  }

  return written;
}

async function main(): Promise<void> {
  loadMarketEnv();
  assertValidDatabaseUrl();

  const verbose = process.argv.includes("--verbose");
  const symbolsFilter = parseSymbolsFilter(process.argv);

  const companyIdBySymbol = loadCompanyIdBySymbol();
  // PSEI is an index, not a filer — no quarterly report exists for it.
  const symbols = loadIngestSymbols().filter(
    (s) => s !== "PSEI" && (!symbolsFilter || symbolsFilter.has(s)),
  );

  const inputs: FundamentalsInput[] = symbols
    .map((symbol) => ({ symbol, companyId: companyIdBySymbol.get(symbol) }))
    .filter((i): i is FundamentalsInput => Boolean(i.companyId));

  console.log(`Fetching fundamentals for ${inputs.length} symbols (3 requests each)...`);

  const rows = await fetchFundamentalsList(inputs, {
    delayMs: 100,
    concurrency: 6,
    onProgress: (done, total) => {
      if (verbose && (done % 10 === 0 || done === total)) {
        console.log(`  ${done}/${total}`);
      }
    },
  });

  console.log(
    `Fetched ${rows.length} of ${inputs.length} symbols (rest had no matching quarterly filing or failed to parse)`,
  );

  const written = await upsertFundamentals(rows);
  console.log(`Upserted ${written} rows to fundamentals_latest`);

  await closeIngestPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
