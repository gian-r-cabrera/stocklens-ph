"use client";

import { useEffect } from "react";

import { useWatchlistStore } from "@/lib/stores/watchlist-store";

export function WatchlistQuotesHydrator() {
  const stocks = useWatchlistStore((s) => s.stocks);
  const refreshPrices = useWatchlistStore((s) => s.refreshPrices);
  const refreshSignals = useWatchlistStore((s) => s.refreshSignals);

  useEffect(() => {
    if (stocks.length === 0) return;
    void Promise.all([refreshPrices(), refreshSignals()]);
  }, [stocks.length, refreshPrices, refreshSignals]);

  return null;
}
