"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { WATCHLIST_MAX_STOCKS } from "@/lib/constants/watchlist";
import { watchlistStocks as seedWatchlist } from "@/lib/data/watchlist";
import type { WatchlistStock } from "@/lib/data/watchlist";
import { TICKER_BY_SYMBOL } from "@/lib/constants/tickers";
import { getStockAnalysisStatic } from "@/lib/data/stocks";
import type { SignalAction } from "@/lib/signal/types";

export type AddStockResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "invalid" | "limit" };

type WatchlistState = {
  stocks: WatchlistStock[];
  addStock: (ticker: string) => AddStockResult;
  removeStock: (ticker: string) => void;
  hasStock: (ticker: string) => boolean;
  isAtLimit: () => boolean;
  refreshPrices: () => Promise<void>;
  refreshSignals: () => Promise<void>;
};

function toWatchlistEntry(ticker: string): WatchlistStock | null {
  const entry = TICKER_BY_SYMBOL[ticker.toUpperCase()];
  if (!entry) return null;

  const analysis = getStockAnalysisStatic(entry.ticker);

  return {
    ticker: entry.ticker,
    name: entry.name,
    price: analysis?.metrics.lastClose ?? "—",
    change: analysis?.metrics.dailyChange ?? "—",
    positive: analysis?.metrics.dailyChangePositive ?? true,
    sector: entry.sector,
    trend: analysis?.trend ?? "Mixed Signal",
    addedDate: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      stocks: seedWatchlist,
      addStock: (ticker) => {
        const normalized = ticker.toUpperCase();
        if (get().stocks.some((s) => s.ticker === normalized)) {
          return { ok: false, reason: "duplicate" };
        }
        if (get().stocks.length >= WATCHLIST_MAX_STOCKS) {
          return { ok: false, reason: "limit" };
        }
        const entry = toWatchlistEntry(normalized);
        if (!entry) return { ok: false, reason: "invalid" };
        set((state) => ({ stocks: [...state.stocks, entry] }));
        return { ok: true };
      },
      removeStock: (ticker) => {
        const normalized = ticker.toUpperCase();
        set((state) => ({
          stocks: state.stocks.filter((s) => s.ticker !== normalized),
        }));
      },
      hasStock: (ticker) =>
        get().stocks.some((s) => s.ticker === ticker.toUpperCase()),
      isAtLimit: () => get().stocks.length >= WATCHLIST_MAX_STOCKS,
      refreshPrices: async () => {
        const tickers = get().stocks.map((s) => s.ticker);
        if (tickers.length === 0) return;

        try {
          const res = await fetch(
            `/api/market/quotes?symbols=${encodeURIComponent(tickers.join(","))}`,
          );
          if (!res.ok) return;
          const body = (await res.json()) as {
            quotes?: Record<
              string,
              {
                lastClose: string;
                dailyChange: string;
                direction?: "up" | "down" | "flat";
                positive: boolean;
              }
            >;
          };
          const quotes = body.quotes;
          if (!quotes) return;

          set((state) => ({
            stocks: state.stocks.map((stock) => {
              const q = quotes[stock.ticker];
              if (!q) return stock;
              const direction =
                q.direction ??
                (q.positive ? "up" : q.dailyChange === "0.0%" ? "flat" : "down");
              return {
                ...stock,
                price: q.lastClose,
                change: q.dailyChange,
                positive: direction === "up",
              };
            }),
          }));
        } catch {
          /* keep cached values */
        }
      },
      refreshSignals: async () => {
        const tickers = get().stocks.map((s) => s.ticker);
        if (tickers.length === 0) return;

        try {
          const res = await fetch(
            `/api/market/signals?symbols=${encodeURIComponent(tickers.join(","))}`,
          );
          if (!res.ok) return;
          const body = (await res.json()) as {
            signals?: Record<string, { action: SignalAction; confidence: number }>;
          };
          const signals = body.signals;
          if (!signals) return;

          set((state) => ({
            stocks: state.stocks.map((stock) => {
              const s = signals[stock.ticker];
              if (!s) return stock;
              return { ...stock, signal: s.action };
            }),
          }));
        } catch {
          /* keep cached values */
        }
      },
    }),
    {
      name: "stocklens-watchlist",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as { stocks?: WatchlistStock[] };
        if (version < 2 && Array.isArray(state.stocks)) {
          return {
            stocks: state.stocks.slice(0, WATCHLIST_MAX_STOCKS),
          };
        }
        // v3 adds an optional `signal` field, populated by refreshSignals() —
        // no transform needed, existing rows simply lack it until refreshed.
        return persisted as WatchlistState;
      },
    },
  ),
);
