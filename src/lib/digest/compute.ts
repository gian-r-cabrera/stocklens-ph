import type { JournalEntry } from "@/lib/journal/types";
import type { SignalAction } from "@/lib/signal/types";
import type { SignalChange } from "@/lib/digest/types";

type WatchlistLike = { ticker: string; name: string; signal?: SignalAction };

/**
 * Diffs a "before" snapshot of watchlist signals against an "after" one.
 * Callers must capture `before` synchronously prior to refreshing signals —
 * this function only compares what it's given, it doesn't fetch anything.
 */
export function computeSignalChanges(
  before: WatchlistLike[],
  after: WatchlistLike[],
): SignalChange[] {
  const beforeByTicker = new Map(before.map((s) => [s.ticker, s.signal ?? null]));
  const changes: SignalChange[] = [];

  for (const stock of after) {
    if (!stock.signal) continue;
    const prev = beforeByTicker.get(stock.ticker) ?? null;
    if (prev !== stock.signal) {
      changes.push({
        ticker: stock.ticker,
        companyName: stock.name,
        from: prev,
        to: stock.signal,
      });
    }
  }

  return changes;
}

/**
 * Entries resolved after `sinceISO` (or everything resolved so far, on the
 * first-ever check when `sinceISO` is null — not a special case, just what
 * "newly resolved since I last looked" means when you've never looked).
 */
export function computeNewlyResolved(
  entries: JournalEntry[],
  sinceISO: string | null,
): JournalEntry[] {
  return entries.filter(
    (e) =>
      e.status === "resolved" &&
      e.resolvedAt != null &&
      (sinceISO == null || e.resolvedAt > sinceISO),
  );
}
