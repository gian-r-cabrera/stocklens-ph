import {
  directionFromChangePct,
  formatChangePct,
} from "@/lib/market/change-direction";
import type { MarketQuote, QuoteDisplay } from "@/lib/market/types";

export { formatChangePct, directionFromChangePct } from "@/lib/market/change-direction";

export function formatPriceAmount(amount: number, isIndex = false): string {
  if (isIndex) {
    return amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (amount >= 1000) {
    return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₱${amount.toFixed(2)}`;
}

/** Inverse of formatPriceAmount — strips the peso sign/grouping commas
 * this codebase's own formatter always produces, for callers that only
 * have a pre-formatted display string (e.g. StockAnalysis.metrics.lastClose)
 * but need a numeric value to compute against. Returns null for the "—"
 * placeholder or anything else that doesn't parse to a real number. */
export function parsePriceAmount(formatted: string): number | null {
  if (formatted === "—") return null;
  const n = Number.parseFloat(formatted.replace(/[₱,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** For company-wide money aggregates (market cap, revenue, net income) —
 * unlike formatPriceAmount (built for per-share prices), these routinely
 * run into the billions, where full-precision centavos are unreadable.
 * Handles negatives (e.g. a net loss) with a leading sign. */
export function formatCompactMoney(value: number | null): string {
  if (value == null) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(2)}K`;
  return `${sign}₱${abs.toFixed(2)}`;
}

export function formatVolumeAmount(volume: number | null): string {
  if (volume == null || volume <= 0) return "—";
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(0)}K`;
  return String(volume);
}

export function quoteToDisplay(
  quote: MarketQuote,
  isIndex = false,
): QuoteDisplay {
  const direction = directionFromChangePct(quote.changePct);
  return {
    lastClose: formatPriceAmount(quote.lastClose, isIndex),
    dailyChange: formatChangePct(quote.changePct),
    direction,
    positive: direction === "up",
    volume: formatVolumeAmount(quote.volume),
  };
}

/** EOD quotes older than this are flagged stale (covers long weekends). */
export const QUOTE_STALE_MAX_AGE_HOURS = 36;

export function isQuoteStale(
  asOf: Date,
  maxAgeHours = QUOTE_STALE_MAX_AGE_HOURS,
): boolean {
  const ageMs = Date.now() - asOf.getTime();
  return ageMs > maxAgeHours * 60 * 60 * 1000;
}

export function formatAsOf(asOf: Date): string {
  return asOf.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
