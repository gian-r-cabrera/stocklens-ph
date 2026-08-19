export type PricePoint = { date: string; close: number };

/**
 * Finds the price `horizonDays` *trading days* after `loggedAt` — same
 * index-offset semantics `backtestConsensusSignal`/`walkForwardBacktest`
 * already use (not calendar days). `loggedAt` itself doesn't need to land
 * on an exact trading date: the first point on or after it is treated as
 * day 0, so logging over a weekend/holiday resolves against the next
 * trading day. Returns null when there isn't enough future data yet
 * (still pending), rather than throwing.
 */
export function findResolutionPrice(
  points: PricePoint[],
  loggedAt: string,
  horizonDays: number,
): { resolvedAt: string; actualPrice: number } | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const startIdx = sorted.findIndex((p) => p.date >= loggedAt);
  if (startIdx === -1) return null;

  const target = sorted[startIdx + horizonDays];
  if (!target) return null;

  return { resolvedAt: target.date, actualPrice: target.close };
}
