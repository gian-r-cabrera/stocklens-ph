import { aggregateTrials, type SignalBacktestTrial } from "@/lib/signal/backtest";
import type { JournalEntry } from "@/lib/journal/types";

/**
 * Maps resolved journal entries into the same trial shape the backtest
 * uses, so the journal's live hit-rate/avg-return numbers are computed by
 * the exact same (already tested) math as the historical backtest —
 * directly comparable, not a second implementation that could drift.
 */
export function resolvedEntriesToTrials(entries: JournalEntry[]): SignalBacktestTrial[] {
  return entries
    .filter(
      (e): e is JournalEntry & { actualReturnPct: number } =>
        e.status === "resolved" && e.actualReturnPct != null,
    )
    .map((e) => ({
      date: e.loggedAt,
      action: e.action,
      confidence: e.confidence,
      forwardReturnPct: e.actualReturnPct,
    }));
}

export function journalStats(entries: JournalEntry[]) {
  return aggregateTrials(resolvedEntriesToTrials(entries));
}
