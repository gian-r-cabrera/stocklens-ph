-- Trailing-12-month cash dividend per share, from PSE EDGE's Dividends and
-- Rights page (COMMON/Cash rows only). See
-- scripts/market/pse-edge-fundamentals.ts's parseDividendPerShareTtm.
-- Apply via: psql $DATABASE_URL -f db/migrations/006_dividends.sql

ALTER TABLE fundamentals_latest
  ADD COLUMN IF NOT EXISTS dividend_per_share_ttm NUMERIC(18, 6);
