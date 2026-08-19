import { getStockAnalysisStatic } from "@/lib/data/stocks";
import type { StockDirectoryEntry, StockDirectoryKind } from "@/lib/data/stock-directory";
import { tickerToPath } from "@/lib/forecast";
import { directionFromChangeString } from "@/lib/market/change-direction";
import type { PriceDirection } from "@/lib/market/change-direction";
import { getCompanyStats } from "@/lib/market/company-stats-repository";
import { getFundamentals } from "@/lib/market/fundamentals-repository";
import { parsePriceAmount, quoteToDisplay } from "@/lib/market/format-quote";
import { toQuotesMap } from "@/lib/market/quotes-map";
import { tickerToSymbol } from "@/lib/market/symbol";
import type { MarketQuote } from "@/lib/market/types";
import { getAllCatalogEntries, isAnalyzedTicker } from "@/lib/pse/universe";

// Server-only: this pulls in the fundamentals/company-stats repositories,
// which import `pg` (Node-only). Kept out of stock-directory.ts because
// that file is also imported by the client <StockDirectory> component for
// its pure filter/lookup helpers — bundling `pg` into the client chunk
// fails the build ("Can't resolve 'fs'/'net'/'tls'").

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

export async function getStockDirectoryEntries(
  quotes?: Map<string, MarketQuote> | Record<string, MarketQuote>,
): Promise<StockDirectoryEntry[]> {
  const quoteMap = toQuotesMap(quotes);
  // Both bare calls (no symbols arg) are a supported, cached full-universe
  // path — see each repository's own getFundamentals/getCompanyStats doc.
  const [fundamentalsMap, companyStatsMap] = await Promise.all([
    getFundamentals(),
    getCompanyStats(),
  ]);

  return getAllCatalogEntries().map((company) => {
    const analysis = company.hasAnalysis
      ? getStockAnalysisStatic(company.ticker)
      : null;
    const isIndex = company.sector === "Index";
    const symbol = tickerToSymbol(company.ticker);
    const quote = quoteMap.get(symbol);

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

    const lastCloseNum = parsePriceAmount(lastClose);
    const fundamentals = fundamentalsMap.get(symbol);
    const companyStats = companyStatsMap.get(symbol);

    const peRatio =
      fundamentals?.epsBasicTtm != null &&
      fundamentals.epsBasicTtm > 0 &&
      lastCloseNum != null
        ? lastCloseNum / fundamentals.epsBasicTtm
        : null;
    const dividendYieldPct =
      fundamentals?.dividendPerShareTtm != null && lastCloseNum
        ? (fundamentals.dividendPerShareTtm / lastCloseNum) * 100
        : null;

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
      lastCloseNum,
      changePctNum: changePctNum ?? parseDisplayChangePct(dailyChange),
      peRatio,
      dividendYieldPct,
      marketCap: companyStats?.marketCap ?? null,
    };
  });
}
