import type { StockDirectoryEntry } from "@/lib/data/stock-directory";

export type DirectorySortKey =
  | "ticker"
  | "change"
  | "price"
  | "peRatio"
  | "dividendYield"
  | "marketCap";
export type DirectoryTierFilter = "all" | "hasPrice" | "analyzed" | "catalog";
export type DirectoryKindFilter = "all" | "equity" | "etf" | "index";
export type DirectoryPeFilter = "all" | "under10" | "under15" | "under20" | "under30";
export type DirectoryYieldFilter = "all" | "atLeast2" | "atLeast4" | "atLeast6";

const PE_MAX: Record<Exclude<DirectoryPeFilter, "all">, number> = {
  under10: 10,
  under15: 15,
  under20: 20,
  under30: 30,
};

const YIELD_MIN: Record<Exclude<DirectoryYieldFilter, "all">, number> = {
  atLeast2: 2,
  atLeast4: 4,
  atLeast6: 6,
};

export function buildSectorCounts(
  entries: StockDirectoryEntry[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.sector] = (counts[entry.sector] ?? 0) + 1;
  }
  return counts;
}

export function filterDirectoryByTier(
  entries: StockDirectoryEntry[],
  tier: DirectoryTierFilter,
): StockDirectoryEntry[] {
  switch (tier) {
    case "hasPrice":
      return entries.filter((e) => e.lastClose !== "—");
    case "analyzed":
      return entries.filter((e) => e.hasAnalysis);
    case "catalog":
      return entries.filter((e) => !e.hasAnalysis);
    default:
      return entries;
  }
}

export function filterDirectoryByKind(
  entries: StockDirectoryEntry[],
  kind: DirectoryKindFilter,
): StockDirectoryEntry[] {
  if (kind === "all") return entries;
  return entries.filter((e) => e.kind === kind);
}

export function filterDirectoryByPe(
  entries: StockDirectoryEntry[],
  filter: DirectoryPeFilter,
): StockDirectoryEntry[] {
  if (filter === "all") return entries;
  const max = PE_MAX[filter];
  return entries.filter((e) => e.peRatio != null && e.peRatio <= max);
}

export function filterDirectoryByDividendYield(
  entries: StockDirectoryEntry[],
  filter: DirectoryYieldFilter,
): StockDirectoryEntry[] {
  if (filter === "all") return entries;
  const min = YIELD_MIN[filter];
  return entries.filter((e) => e.dividendYieldPct != null && e.dividendYieldPct >= min);
}

export function sortDirectoryEntries(
  entries: StockDirectoryEntry[],
  sortKey: DirectorySortKey,
): StockDirectoryEntry[] {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "change":
        return (b.changePctNum ?? -Infinity) - (a.changePctNum ?? -Infinity);
      case "price":
        return (b.lastCloseNum ?? -Infinity) - (a.lastCloseNum ?? -Infinity);
      // Ascending — lower P/E reads as "cheaper", the conventional
      // value-screener direction. Nulls (no data) sink to the bottom
      // regardless of a sort's direction, never ranking as "best."
      case "peRatio":
        return (a.peRatio ?? Infinity) - (b.peRatio ?? Infinity);
      case "dividendYield":
        return (b.dividendYieldPct ?? -Infinity) - (a.dividendYieldPct ?? -Infinity);
      case "marketCap":
        return (b.marketCap ?? -Infinity) - (a.marketCap ?? -Infinity);
      case "ticker":
      default:
        return a.ticker.localeCompare(b.ticker);
    }
  });
  return sorted;
}
