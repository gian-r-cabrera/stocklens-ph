import { NextResponse } from "next/server";

import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
import { getDailyBars } from "@/lib/market/bars-repository";
import { getModelMetrics } from "@/lib/market/forecasts-repository";
import { symbolToTicker, tickerToSymbol } from "@/lib/market/symbol";
import { SIGNAL_HORIZON_DAYS, computeTickerSignal } from "@/lib/signal/consensus";
import type { SignalAction } from "@/lib/signal/types";

export const revalidate = 60;

export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkRateLimit(`market-signals:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const tickers = symbolsParam
    ? symbolsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const payload: Record<string, { action: SignalAction; confidence: number }> = {};

  await Promise.all(
    tickers.map(async (rawTicker) => {
      const symbol = tickerToSymbol(rawTicker);
      // Index tickers have no per-share buy/sell semantics — same rule the
      // stock-detail builder applies (signal/entryExitPlan both null there).
      if (symbol === "PSEI") return;

      const ticker = symbolToTicker(symbol);
      const [bars, metrics] = await Promise.all([
        getDailyBars(ticker, "90d"),
        getModelMetrics(ticker, SIGNAL_HORIZON_DAYS),
      ]);
      const signal = computeTickerSignal(bars, metrics, SIGNAL_HORIZON_DAYS);
      if (!signal.dataSufficient) return;
      payload[ticker] = { action: signal.action, confidence: signal.confidence };
    }),
  );

  return NextResponse.json(
    { signals: payload },
    { headers: rateLimitHeaders(limit) },
  );
}
