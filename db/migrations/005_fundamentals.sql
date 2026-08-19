-- Real per-filing fundamentals, parsed from the latest SEC Form 17-Q
-- (quarterly report) cover sheet PSE EDGE renders as structured HTML —
-- NOT PDF-extracted. See scripts/market/pse-edge-fundamentals.ts.
-- Apply via: psql $DATABASE_URL -f db/migrations/005_fundamentals.sql

CREATE TABLE IF NOT EXISTS fundamentals_latest (
  symbol TEXT PRIMARY KEY,
  period_ended DATE NOT NULL,
  total_assets NUMERIC(24, 2),
  total_liabilities NUMERIC(24, 2),
  stockholders_equity NUMERIC(24, 2),
  book_value_per_share NUMERIC(18, 6),
  gross_revenue_ytd NUMERIC(24, 2),
  net_income_ytd NUMERIC(24, 2),
  eps_basic_ttm NUMERIC(18, 6),
  eps_diluted_ttm NUMERIC(18, 6),
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
