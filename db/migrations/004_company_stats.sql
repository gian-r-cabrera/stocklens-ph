-- Company-size/liquidity reference stats from PSE EDGE's stockdataList
-- endpoint (market cap, shares outstanding, free float, foreign ownership
-- limit, par value). NOT P/E-style fundamentals — no EPS/revenue/dividend
-- data here; that needs disclosure-PDF parsing, a separate unbuilt project.
-- Apply via: psql $DATABASE_URL -f db/migrations/004_company_stats.sql

CREATE TABLE IF NOT EXISTS company_stats_latest (
  symbol TEXT PRIMARY KEY,
  market_cap NUMERIC(20, 2),
  outstanding_shares NUMERIC(20, 2),
  free_float_pct NUMERIC(10, 4),
  foreign_ownership_limit_pct NUMERIC(10, 4),
  par_value NUMERIC(18, 6),
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
