"use client";

import { ForecastDisclaimer } from "@/components/dashboard/forecast-disclaimer";
import { WatchlistCards } from "@/components/watchlist/watchlist-cards";
import { WatchlistEmpty } from "@/components/watchlist/watchlist-empty";
import { WatchlistPortfolioBacktest } from "@/components/watchlist/watchlist-portfolio-backtest";
import { WatchlistSignalBacktest } from "@/components/watchlist/watchlist-signal-backtest";
import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { WatchlistQuotesHydrator } from "@/components/watchlist/watchlist-quotes-hydrator";
import { useWatchlistStore } from "@/lib/stores/watchlist-store";

export function WatchlistContent() {
  const stocks = useWatchlistStore((s) => s.stocks);

  if (stocks.length === 0) {
    return <WatchlistEmpty />;
  }

  return (
    <>
      <WatchlistQuotesHydrator />
      <WatchlistCards />
      <WatchlistTable />
      <WatchlistPortfolioBacktest />
      <WatchlistSignalBacktest />
      <ForecastDisclaimer />
    </>
  );
}
