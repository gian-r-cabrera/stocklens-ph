# Market data ingest — keep StockLens updated

Batch EOD only (not real-time). Run after PSE close or on a schedule.

**Related:** [`README.md`](README.md) (migrations, roles) · [`DSS-OPS.md`](DSS-OPS.md) (VM cron, PM2)

## Prerequisites

### Environment

| File | Used by | Required vars |
|------|---------|----------------|
| `.env` | Prisma migrate | `DIRECT_URL` (port **5432**) |
| `.env.local` | Next.js dev + ingest scripts | `MARKET_DATA_SOURCE=db`, `DATABASE_URL` (pooler **6543**, `?pgbouncer=true`) |
| `.env.ingest` | Cron on DSS (optional) | Writer `DATABASE_URL` |

**Forecasts snapshot (all modes):** `SUPABASE_URL` (public, `https://<project-ref>.supabase.co`) is needed to *read* the snapshot — put it wherever the app runs (`.env.local`, Vercel env vars). `SUPABASE_SERVICE_ROLE_KEY` is needed only to *publish* it and must stay ingest-only (`.env.local`/`.env.ingest`/GitHub Actions secret) — never in the deployed app's runtime env.

**Supabase hostname:** copy the full pooler host from the dashboard (e.g. `aws-1-ap-southeast-1.pooler.supabase.com`). Do not use the region slug alone (`ap-southeast-1.pooler...` → DNS error).

URL-encode special characters in passwords (`!` → `%21`).

### One-time database setup

```bash
npm run prisma:migrate
npm run prisma:generate
```

Tables: `market_quotes_latest`, `market_bars_daily`, `market_forecasts_latest`, `market_model_metrics`, `rate_limits`, `company_stats_latest`, `fundamentals_latest`.

Apply forecast tables if migrating manually:

```bash
psql "$DATABASE_URL" -f db/migrations/002_forecast_tables.sql
```

Apply company stats table if migrating manually:

```bash
psql "$DATABASE_URL" -f db/migrations/004_company_stats.sql
```

`company_stats_latest` (market cap, shares outstanding, free float, foreign
ownership limit, par value — from PSE EDGE's `stockdataList`, not P/E-style
fundamentals) is a manual/occasional ingest, not a scheduled cron — this
data moves slowly. Run `npm run ingest:company-stats` whenever you want
fresher numbers.

Apply fundamentals table if migrating manually:

```bash
psql "$DATABASE_URL" -f db/migrations/005_fundamentals.sql
```

`fundamentals_latest` (Total Assets/Liabilities, Stockholders' Equity, Book
Value/Share, Revenue and Net Income YTD, EPS trailing-12mo basic/diluted —
real P/E-capable fundamentals) is parsed from the latest SEC Form 17-Q
quarterly-report cover sheet, which PSE EDGE renders as structured HTML
(see `scripts/market/pse-edge-fundamentals.ts` — not PDF extraction).
Manual/occasional ingest, not a cron — quarterly filings don't need one,
and it's a 3-4-request-per-company chain. Run `npm run ingest:fundamentals`
whenever you want fresher numbers.

Add the dividends column if migrating manually (already part of
`fundamentals_latest`, just a later ALTER TABLE):

```bash
psql "$DATABASE_URL" -f db/migrations/006_dividends.sql
```

Trailing-12-month cash dividend per share (COMMON/Cash rows only, from PSE
EDGE's Dividends and Rights page) is fetched concurrently with the
quarterly cover-sheet chain during the same `ingest:fundamentals` run —
no separate command.

---

## Ingest commands

From project root:

```bash
# 1. Latest EOD quotes (~284 symbols + PSEi) → Postgres
npm run ingest:quotes

# 2. Daily OHLCV bars (all listed equities + PSEI) → Postgres
npm run ingest:bars

# 3. Baseline forecasts + walk-forward metrics → Postgres
npm run ingest:forecasts

# 4. Verify
npm run health:market
```

Restart the dev server after env changes: `npm run dev`.

### Data sources

| Data | Primary | Fallback |
|------|---------|----------|
| Quotes | PSE EDGE | `npm run ingest:quotes -- --source=yahoo` |
| PSEi bars | Yahoo | — |
| Equity bars | PSE EDGE `DisclosureCht.ax` | Yahoo `.PS` is indices-only; equities use EDGE |

### Bars ingest notes

- Full universe: **~283 equities + PSEI** from `data/pse-official-universe.json`
- Default delay **700ms/symbol**, concurrency **3** (`--concurrency=` to override, capped at 5 to respect EDGE rate limits)
- Equities fetch from PSE EDGE only (Yahoo `.PS` doesn't resolve individual PH tickers, so it's skipped for equities — only PSEI uses Yahoo)
- Health check warns if equity symbol count **< 250**

### Debug

```bash
npm run ingest:bars -- --probe=BDO --verbose
npm run ingest:forecasts -- --probe=BDO
```

### Full pipeline (DSS helper)

```bash
npm run setup:dss -- --ingest
```

---

## When to run (Asia/Manila)

| When | Command | Why |
|------|---------|-----|
| **Mon–Fri ~18:00** (after PSE close) | `ingest:quotes` → `ingest:bars` → `ingest:forecasts` | Fresh EOD prices, charts, forecasts |
| **Mon–Fri every 10 min, 9:30–15:30** | `.github/workflows/market-intraday-refresh.yml` (GitHub Actions) — `ingest:quotes -- --symbols=PSEI,BDO,JFC,ALI,TEL,SMPH --respect-market-hours`; `db/cron.example.sh`'s every-2-min line covers the same command if run on a VM, but that deployment was never confirmed running | Live dashboard price refresh (6 fixed symbols only — see below) |
| **Sunday ~06:00** | `npm run sync:pse` | Refresh listing directory if PSE listings changed |
| **After `sync:pse`** | Commit `data/pse-official-universe.json` if diff | Keeps stock directory in sync |

Example cron (DSS VM, if you'd rather not rely on GitHub Actions):

```cron
0 18 * * 1-5 /path/to/stocklens-ph/db/cron.example.sh >> /var/log/stocklens-ingest.log 2>&1
*/2 9-15 * * 1-5 flock -n /tmp/stocklens-intraday.lock -c "cd /path/to/stocklens-ph && npm run ingest:quotes -- --symbols=PSEI,BDO,JFC,ALI,TEL,SMPH --respect-market-hours" >> /var/log/stocklens-intraday.log 2>&1
```

See [`cron.example.sh`](cron.example.sh) and [`crontab.example`](crontab.example).

### Intraday dashboard refresh

The dashboard's 6 fixed featured symbols (`PSEI`, `BDO`, `JFC`, `ALI`, `TEL`, `SMPH` — see `src/lib/data/dashboard-featured.ts`) refresh every ~60s during trading hours instead of waiting for the next day's batch — the client-side poll and "Live" indicator (`src/components/dashboard/market-overview.tsx`) were already built and are live in production, gated purely on `MARKET_DATA_SOURCE=db` being reachable (true for current production). What was actually missing was anything populating fresher rows during the day: `.github/workflows/market-intraday-refresh.yml` now does that every 10 minutes. GitHub Actions can't reliably do the DSS example's every-2-minute cadence (short intervals get delayed under load), so 10 minutes is the practical floor — still a large step up from "once after close." **Deliberately not** the full ~284-symbol universe: PSE EDGE's quotes endpoint (`scripts/market/pse-edge-quotes.ts`) is one request per symbol and scoped to once-daily EOD use — polling all symbols this often would risk the ingest IP getting throttled or blocked. `--respect-market-hours` makes the script no-op outside 9:30–15:30 Manila (checked via `src/lib/market/pse-session.ts`), so the coarser cron hour window is safe.

---

## Keep each target updated

### Local dev (`MARKET_DATA_SOURCE=db`)

1. Run ingest on trading days (commands above).
2. `npm run health:market`
3. Restart dev: `npm run dev`

### Vercel (static — no Postgres)

Vercel does **not** read Supabase by default. Refresh the committed snapshot:

```bash
npm run ingest:quotes:snapshot
npm run validate:data
git add data/market-quotes-snapshot.json
git commit -m "chore: refresh market snapshot"
git push
```

Vercel env: `MARKET_DATA_SOURCE=static` (no `DATABASE_URL`).

Optional: enable [`.github/workflows/market-snapshot.yml`](../.github/workflows/market-snapshot.yml) for scheduled snapshot refresh on GitHub Actions.

**Failure alerting:** all four scheduled ingest workflows (`market-snapshot.yml`, `market-live-refresh.yml`, `market-forecasts-snapshot.yml`, `market-forecasts-lstm.yml`) file/reuse a GitHub issue labeled `ingest-failure` when the run fails — see [`.github/ingest-failure-issue.md`](../.github/ingest-failure-issue.md). This does not cover `cron.example.sh` (DSS VM) — that script has no alerting wired up yet.

**Forecasts snapshot (Vercel):** publishes directly to Supabase Storage — no git commit. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (ingest-only, never in the app's runtime env).

```bash
npm run ingest:forecasts:snapshot
```

**Note:** Vercel has no live Postgres. The quotes snapshot is committed JSON; the forecasts snapshot lives in Supabase Storage and is read at request time (cached 5 min) instead of bundled at build time. Full bars/charts require `MARKET_DATA_SOURCE=db` (local / DSS).

### DSS production (`MARKET_DATA_SOURCE=db`)

1. Quotes and bars are refreshed automatically on GitHub Actions —
   [`.github/workflows/market-live-refresh.yml`](../.github/workflows/market-live-refresh.yml),
   weekdays ~10:00 UTC (18:00 Manila), writing directly to the live
   `market_quotes_latest`/`market_bars_daily` tables via a `DATABASE_URL`
   repo secret. Forecasts refresh ~90 min later via
   `market-forecasts-snapshot.yml`, so they're built from same-day bars.
2. `cron.example.sh` (DSS VM) runs the same quotes → bars → forecasts →
   `health:market` sequence and is documented as the intended production
   path, but its actual deployment status has never been confirmed — as of
   Aug 2026, quotes had silently gone stale for a week with nothing
   catching it before `market-live-refresh.yml` was added. Treat the VM
   cron as a nice-to-have alongside GitHub Actions, not the only thing
   keeping this fresh.
3. App uses **read-only** `DATABASE_URL`; cron/Actions use a **writer**
   role (`.env.ingest` for the VM; a repo secret for Actions).
4. Full VM setup: [`DSS-OPS.md`](DSS-OPS.md).

---

## Health checks

**CLI**

```bash
npm run health:market
```

**Supabase SQL Editor**

```sql
SELECT COUNT(*) FROM market_quotes_latest;
SELECT COUNT(*) FROM market_bars_daily WHERE symbol = 'PSEI';
SELECT MAX(as_of) FROM market_quotes_latest;
SELECT symbol, COUNT(*) FROM market_bars_daily
WHERE symbol IN ('PSEI', 'BDO', 'JFC')
GROUP BY symbol;
```

**Expected (trading day)**

- Quotes: ~**284**
- PSEI bars: **> 0**
- `as_of`: within ~**36 hours** (stale over weekends until Monday ingest)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ENOTFOUND` / pooler host | Use full `aws-N-REGION.pooler.supabase.com` in `DATABASE_URL` |
| `health:market` fails | Fix `.env.local`, run migrate, then ingest |
| Equity bars = 0 | Re-run `ingest:bars`; try `--probe=SYMBOL --verbose` |
| Dashboard stale on Vercel | Run `ingest:quotes:snapshot`, commit JSON, push |
| Vercel deploy failed | Run `npm run build` locally; fix errors, push |

---

## Quick reference

```bash
npm run ingest:quotes              # quotes → DB
npm run ingest:bars                # bars → DB (all listed; ~45–90 min)
npm run ingest:forecasts           # baselines + metrics → DB
npm run ingest:forecasts:snapshot  # forecasts → DB + Supabase Storage (Vercel)
npm run ingest:forecasts:lstm      # optional LSTM rows (Python)
npm run ingest:quotes:snapshot     # quotes → DB + snapshot file (Vercel)
npm run health:market              # post-ingest check
npm run sync:pse                   # weekly universe sync
npm run setup:market-data          # alias for snapshot quotes ingest
```
