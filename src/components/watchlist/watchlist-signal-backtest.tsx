"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignalStatsTable } from "@/components/signal/signal-stats-table";
import type { SignalActionStats } from "@/lib/signal/backtest";
import { formatPct } from "@/lib/signal/format";
import type { SignalAction } from "@/lib/signal/types";
import { useWatchlistStore } from "@/lib/stores/watchlist-store";

type Skipped = { ticker: string; reason: string };

type BacktestResponse =
  | { available: false; reason: string }
  | {
      available: true;
      horizonDays: number;
      trialCount: number;
      byAction: Record<SignalAction, SignalActionStats>;
      baselineAvgReturnPct: number | null;
      tickersUsed: string[];
      tickersSkipped: Skipped[];
    };

export function WatchlistSignalBacktest() {
  const stocks = useWatchlistStore((s) => s.stocks);
  const tickersKey = stocks.map((s) => s.ticker).join(",");

  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = tickersKey !== "" && loadedKey !== tickersKey;

  useEffect(() => {
    if (!tickersKey) return;
    let cancelled = false;
    fetch(`/api/watchlist/signal-backtest?tickers=${encodeURIComponent(tickersKey)}`)
      .then((res) => (res.ok ? (res.json() as Promise<BacktestResponse>) : null))
      .then((result) => {
        if (cancelled) return;
        if (result) setData(result);
        setLoadedKey(tickersKey);
      });
    return () => {
      cancelled = true;
    };
  }, [tickersKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Backtest</CardTitle>
        <CardDescription className="mt-1">
          Would the Buy/Hold/Avoid signal have actually worked on your watchlist? Walks
          back through a year of price history, regenerating each historical call from
          only the data available at the time (7-day horizon, fixed).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !data ? (
          <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
        ) : !data.available ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
            Signal backtesting needs live market data — none is available in this
            deployment.
          </div>
        ) : data.trialCount === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
            Not enough price history yet for any watchlist ticker.
          </div>
        ) : (
          <>
            <SignalStatsTable byAction={data.byAction} countLabel="Trials" />
            <p className="text-sm text-muted-foreground">
              Across {data.trialCount} backtested calls, Buy signals averaged{" "}
              {formatPct(data.byAction.buy.avgReturnPct)} over the following{" "}
              {data.horizonDays} trading days, versus {formatPct(data.baselineAvgReturnPct)}{" "}
              on an average day regardless of signal.
            </p>
            <p className="text-xs text-muted-foreground">
              Each historical call re-derives model weights using only data available up
              to that day (no lookahead) — same walk-forward method as Portfolio Model
              Fit above. Small sample sizes are common on a {stocks.length}-stock
              watchlist; read directionally, not statistically.
            </p>
            {data.tickersSkipped.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Skipped:{" "}
                {data.tickersSkipped
                  .map((s) => `${s.ticker} (${s.reason})`)
                  .join(", ")}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
