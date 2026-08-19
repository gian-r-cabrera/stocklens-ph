/**
 * Company-size/liquidity stats ingest → company_stats_latest
 * Run: npm run ingest:company-stats
 * Manual/occasional job, not a scheduled cron — this data (market cap,
 * shares outstanding, free float, foreign limit) moves slowly, unlike
 * prices. Run it whenever you want fresher numbers.
 * Flags: --symbols=BDO,JFC,... (allow-list), --verbose
 */
import "dotenv/config";

import { closeIngestPool, getIngestPool } from "./lib/db-ingest";
import { assertValidDatabaseUrl, loadMarketEnv } from "./lib/load-market-env";
import {
  fetchPseEdgeCompanyStatsList,
  type EdgeStatsInput,
} from "./market/pse-edge-company-stats";
import { loadCompanyIdBySymbol, loadIngestSymbols } from "./lib/universe-symbols";
import type { CompanyStats } from "../src/lib/market/types";

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

async function upsertCompanyStats(stats: CompanyStats[]): Promise<number> {
  const pool = getIngestPool();
  let written = 0;

  for (const s of stats) {
    await pool.query(
      `INSERT INTO company_stats_latest
         (symbol, market_cap, outstanding_shares, free_float_pct, foreign_ownership_limit_pct, par_value, as_of)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (symbol) DO UPDATE SET
         market_cap = EXCLUDED.market_cap,
         outstanding_shares = EXCLUDED.outstanding_shares,
         free_float_pct = EXCLUDED.free_float_pct,
         foreign_ownership_limit_pct = EXCLUDED.foreign_ownership_limit_pct,
         par_value = EXCLUDED.par_value,
         as_of = EXCLUDED.as_of`,
      [
        s.symbol,
        s.marketCap,
        s.outstandingShares,
        s.freeFloatPct,
        s.foreignOwnershipLimitPct,
        s.parValue,
        s.asOf.toISOString(),
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
  // PSEI is an index, not a company — no market cap/shares-outstanding
  // concept applies, so it's excluded rather than fetched and stored null.
  const symbols = loadIngestSymbols().filter(
    (s) => s !== "PSEI" && (!symbolsFilter || symbolsFilter.has(s)),
  );

  const inputs: EdgeStatsInput[] = symbols
    .map((symbol) => ({ symbol, companyId: companyIdBySymbol.get(symbol) }))
    .filter((i): i is EdgeStatsInput => Boolean(i.companyId));

  console.log(`Fetching company stats for ${inputs.length} symbols...`);

  const stats = await fetchPseEdgeCompanyStatsList(inputs, {
    delayMs: 50,
    concurrency: 10,
    onProgress: (done, total) => {
      if (verbose && (done % 25 === 0 || done === total)) {
        console.log(`  ${done}/${total}`);
      }
    },
  });

  console.log(`Fetched ${stats.length} of ${inputs.length} symbols`);

  const written = await upsertCompanyStats(stats);
  console.log(`Upserted ${written} rows to company_stats_latest`);

  await closeIngestPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
