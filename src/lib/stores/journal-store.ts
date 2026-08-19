"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { tickerToPath } from "@/lib/forecast";
import { findResolutionPrice, type PricePoint } from "@/lib/journal/resolve";
import type { JournalEntry, NewJournalEntryInput } from "@/lib/journal/types";

type JournalState = {
  entries: JournalEntry[];
  addEntry: (input: NewJournalEntryInput) => void;
  removeEntry: (id: string) => void;
  /** Splices back a previously-removed entry unchanged (id, resolution
   * status, etc. all preserved) — used by the journal table's Undo action,
   * which must restore exactly what was removed, not re-log a fresh call. */
  restoreEntry: (entry: JournalEntry) => void;
  resolveEntries: () => Promise<void>;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (input) => {
        const entry: JournalEntry = {
          ...input,
          id: crypto.randomUUID(),
          loggedAt: today(),
          status: "pending",
          resolvedAt: null,
          actualPrice: null,
          actualReturnPct: null,
        };
        set((state) => ({ entries: [entry, ...state.entries] }));
      },
      removeEntry: (id) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
      },
      restoreEntry: (entry) => {
        set((state) => ({ entries: [entry, ...state.entries] }));
      },
      resolveEntries: async () => {
        const pending = get().entries.filter((e) => e.status === "pending");
        if (pending.length === 0) return;

        const tickers = [...new Set(pending.map((e) => e.ticker))];
        const pointsByTicker = new Map<string, PricePoint[]>();

        await Promise.all(
          tickers.map(async (ticker) => {
            try {
              const path = tickerToPath(ticker);
              const res = await fetch(`/api/stocks/${path}/indicators?range=1y`);
              if (!res.ok) return;
              const body = (await res.json()) as { points?: PricePoint[] };
              if (body.points) pointsByTicker.set(ticker, body.points);
            } catch {
              /* leave this ticker's entries pending */
            }
          }),
        );

        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.status !== "pending") return entry;
            const points = pointsByTicker.get(entry.ticker);
            if (!points) return entry;

            const resolution = findResolutionPrice(points, entry.loggedAt, entry.horizonDays);
            if (!resolution) return entry;

            const actualReturnPct =
              ((resolution.actualPrice - entry.entryPrice) / entry.entryPrice) * 100;

            return {
              ...entry,
              status: "resolved",
              resolvedAt: resolution.resolvedAt,
              actualPrice: resolution.actualPrice,
              actualReturnPct,
            };
          }),
        }));
      },
    }),
    {
      name: "stocklens-journal",
      version: 1,
    },
  ),
);
