import type { PriceDirection } from "@/lib/market/change-direction";
import {
  getListedEquityCount,
  getPseMeta,
  getPseSectors,
  getSubsectorsForSector,
} from "@/lib/pse/universe";
import type { ForecastTrend } from "@/lib/types/stock";

export type StockDirectoryKind = "equity" | "index" | "etf";

export type StockDirectoryEntry = {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  path: string;
  kind: StockDirectoryKind;
  lastClose: string;
  dailyChange: string;
  positive: boolean;
  changeDirection: PriceDirection;
  trend: ForecastTrend | null;
  hasAnalysis: boolean;
  /** For sort; null when no price */
  lastCloseNum: number | null;
  /** For sort; null when unknown */
  changePctNum: number | null;
  /** null when no fundamentals filing found, or EPS TTM <= 0 (a negative-
   * earnings P/E is misleading noise, not a real ratio). */
  peRatio: number | null;
  /** null when no fundamentals filing, or the company paid no TTM dividend. */
  dividendYieldPct: number | null;
  /** null when no company-stats row found. */
  marketCap: number | null;
};

// This file is imported by the client-side <StockDirectory> component (for
// the pure filter/lookup helpers below), so it must stay free of anything
// that pulls in Node-only code — building StockDirectoryEntry[] itself
// needs the fundamentals/company-stats repositories (which import `pg`),
// so that lives server-only in stock-directory-server.ts instead.

export function getEquityDirectoryCount(): number {
  return getListedEquityCount();
}

export function getDirectoryMeta() {
  return getPseMeta();
}

export function getDirectorySectors(entries: StockDirectoryEntry[]): string[] {
  if (entries.length > 0) {
    const sectors = new Set(entries.map((e) => e.sector));
    return Array.from(sectors).sort((a, b) => a.localeCompare(b));
  }
  return getPseSectors();
}

export function getDirectorySubsectors(
  entries: StockDirectoryEntry[],
  sector: string,
): string[] {
  if (sector === "all") return [];
  const fromEntries = new Set(
    entries.filter((e) => e.sector === sector).map((e) => e.subsector),
  );
  if (fromEntries.size > 0) {
    return Array.from(fromEntries).sort((a, b) => a.localeCompare(b));
  }
  return getSubsectorsForSector(sector);
}

export function filterStockDirectory(
  entries: StockDirectoryEntry[],
  query: string,
  sector: string,
  subsector: string,
): StockDirectoryEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (sector !== "all" && entry.sector !== sector) return false;
    if (subsector !== "all" && entry.subsector !== subsector) return false;
    if (!q) return true;
    return (
      entry.ticker.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.sector.toLowerCase().includes(q) ||
      entry.subsector.toLowerCase().includes(q) ||
      entry.path.includes(q)
    );
  });
}
