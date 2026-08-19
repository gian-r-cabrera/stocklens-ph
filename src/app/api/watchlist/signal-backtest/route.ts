import { NextResponse } from "next/server";

import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
import { WATCHLIST_MAX_STOCKS } from "@/lib/constants/watchlist";
import { isDbMarketEnabled } from "@/lib/db/config";
import { getDailyBars } from "@/lib/market/bars-repository";
import {
  aggregateTrials,
  backtestConsensusSignal,
  type SignalBacktestTrial,
} from "@/lib/signal/backtest";
import { SIGNAL_HORIZON_DAYS } from "@/lib/signal/consensus";
import { tickerSymbolSchema } from "@/lib/validation/ticker";

const MAX_TICKERS = WATCHLIST_MAX_STOCKS;

export const revalidate = 300;

type Skipped = { ticker: string; reason: string };

export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkRateLimit(`watchlist-signal-backtest:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") ?? "";
  const rawTickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TICKERS);

  const validTickers: string[] = [];
  const tickersSkipped: Skipped[] = [];
  for (const raw of rawTickers) {
    const parsed = tickerSymbolSchema.safeParse(raw);
    if (parsed.success) {
      validTickers.push(parsed.data);
    } else {
      tickersSkipped.push({ ticker: raw, reason: "unsupported ticker" });
    }
  }

  // Unlike /api/watchlist/backtest, there's no published snapshot of
  // day-by-day trial data for static/Vercel deploys to fall back to — the
  // forecasts snapshot only carries final aggregate metrics, not the
  // point-in-time series this backtest needs. Report unavailable rather
  // than fake a fallback.
  if (!isDbMarketEnabled()) {
    return NextResponse.json(
      { available: false, reason: "static" },
      { headers: rateLimitHeaders(limit) },
    );
  }

  const barsPerTicker = await Promise.all(
    validTickers.map((ticker) => getDailyBars(ticker, "1y")),
  );

  const allTrials: SignalBacktestTrial[] = [];
  const tickersUsed: string[] = [];

  validTickers.forEach((ticker, i) => {
    const result = backtestConsensusSignal(barsPerTicker[i]!, SIGNAL_HORIZON_DAYS);
    if (result.trials.length === 0) {
      tickersSkipped.push({ ticker, reason: "insufficient price history" });
      return;
    }
    allTrials.push(...result.trials);
    tickersUsed.push(ticker);
  });

  const { byAction, baselineAvgReturnPct } = aggregateTrials(allTrials);

  return NextResponse.json(
    {
      available: true,
      horizonDays: SIGNAL_HORIZON_DAYS,
      trialCount: allTrials.length,
      byAction,
      baselineAvgReturnPct,
      tickersUsed,
      tickersSkipped,
    },
    { headers: rateLimitHeaders(limit) },
  );
}
