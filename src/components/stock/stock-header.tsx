"use client";

import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendBadge } from "@/components/ui/trend-badge";
import { WATCHLIST_MAX_STOCKS } from "@/lib/constants/watchlist";
import {
  isSeedWatchlistAtLimit,
  isSeededWatchlistTicker,
  useWatchlistStore,
} from "@/lib/stores/watchlist-store";
import type { StockAnalysis } from "@/lib/types/stock-analysis";
import {
  watchlistAddDescription,
  watchlistAddToast,
} from "@/lib/watchlist";

export function StockHeader({ analysis }: { analysis: StockAnalysis }) {
  const { info, lastUpdated, trend } = analysis;
  const addStock = useWatchlistStore((s) => s.addStock);
  const liveHasStock = useWatchlistStore((s) => s.hasStock(info.ticker));
  const liveAtLimit = useWatchlistStore((s) => s.isAtLimit());

  // SSR has no access to the visitor's real localStorage, so it always
  // renders against the store's hardcoded seed. The client's first paint
  // must match that exactly (not the real persisted watchlist, which can
  // differ) to avoid a hydration mismatch — so this only switches to the
  // live store value once mounted, after hydration has already settled.
  // (useSyncExternalStore, not useState+useEffect, so there's no setState
  // call to trigger the extra cascading render.)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const hasStock = mounted ? liveHasStock : isSeededWatchlistTicker(info.ticker);
  const atLimit = mounted ? liveAtLimit : isSeedWatchlistAtLimit;
  const watchlistFull = atLimit && !hasStock;

  const handleAddToWatchlist = () => {
    const result = addStock(info.ticker);
    const kind = watchlistAddToast(result);
    const description = watchlistAddDescription(result, info.ticker);
    if (kind === "success") toast.success(description);
    else if (kind === "message") toast.message(description);
    else if (kind === "error") toast.error(description);
  };

  return (
    <div className="space-y-4 border-b pb-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{info.name}</h1>
            <TrendBadge trend={trend} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums text-lg text-muted-foreground">
              {info.ticker}
            </span>
            <Badge variant="outline">{info.sector}</Badge>
            <Badge variant="secondary">{info.subsector}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>
        <Button
          variant={hasStock ? "secondary" : "default"}
          className="gap-2"
          onClick={handleAddToWatchlist}
          disabled={hasStock || watchlistFull}
          title={
            watchlistFull
              ? `Watchlist is full (${WATCHLIST_MAX_STOCKS} stocks max)`
              : undefined
          }
        >
          <Star className="h-4 w-4" aria-hidden />
          {hasStock
            ? "On watchlist"
            : watchlistFull
              ? "Watchlist full"
              : "Add to watchlist"}
        </Button>
      </div>
    </div>
  );
}
