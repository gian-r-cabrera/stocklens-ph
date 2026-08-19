import { getStockAnalysisStatic } from "@/lib/data/stocks";
import { tickerToPath } from "@/lib/forecast";
import { directionFromChangeString } from "@/lib/market/change-direction";
import type { PriceDirection } from "@/lib/market/change-direction";
import { parsePriceAmount, quoteToDisplay } from "@/lib/market/format-quote";
import { toQuotesMap } from "@/lib/market/quotes-map";
import { tickerToSymbol } from "@/lib/market/symbol";
import type { MarketQuote } from "@/lib/market/types";
import {
  getAllCatalogEntries,
  getListedEquityCount,
  getPseMeta,
  getPseSectors,
  getSubsectorsForSector,
  isAnalyzedTicker,
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
};


function parseDisplayChangePct(value: string): number | null {
  if (value === "—") return null;
  const n = Number.parseFloat(value.replace(/%/g, "").replace(/\+/g, ""));
  return Number.isNaN(n) ? null : n;
}

function kindFromSector(sector: string): StockDirectoryKind {
  if (sector === "Index") return "index";
  if (sector === "ETF") return "etf";
  return "equity";
}

export function getStockDirectoryEntries(
  quotes?: Map<string, MarketQuote> | Record<string, MarketQuote>,
): StockDirectoryEntry[] {
  const quoteMap = toQuotesMap(quotes);
  return getAllCatalogEntries().map((company) => {
    const analysis = company.hasAnalysis
      ? getStockAnalysisStatic(company.ticker)
      : null;
    const isIndex = company.sector === "Index";
    const quote = quoteMap.get(tickerToSymbol(company.ticker));

    let lastClose = analysis?.metrics.lastClose ?? "—";
    let dailyChange = analysis?.metrics.dailyChange ?? "—";
    let changeDirection: PriceDirection = analysis
      ? directionFromChangeString(analysis.metrics.dailyChange)
      : "flat";

    let changePctNum: number | null = null;

    if (quote) {
      const display = quoteToDisplay(quote, isIndex);
      lastClose = display.lastClose;
      dailyChange = display.dailyChange;
      changeDirection = display.direction;
      changePctNum = quote.changePct;
    }

    return {
      ticker: company.ticker,
      name: company.companyName,
      sector: company.sector,
      subsector: company.subsector,
      path: company.path || tickerToPath(company.ticker),
      kind: kindFromSector(company.sector),
      lastClose,
      dailyChange,
      positive: changeDirection === "up",
      changeDirection,
      trend: analysis?.trend ?? null,
      hasAnalysis: isAnalyzedTicker(company.ticker),
      lastCloseNum: parsePriceAmount(lastClose),
      changePctNum:
        changePctNum ?? parseDisplayChangePct(dailyChange),
    };
  });
}

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
