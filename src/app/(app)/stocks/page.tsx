import { MarketDataNotice } from "@/components/stocks/market-data-notice";
import { SectorSummary } from "@/components/stocks/sector-summary";
import { StockDirectory } from "@/components/stocks/stock-directory";
import { PageShell } from "@/components/layout/page-shell";
import { getQuotesForSymbols } from "@/lib/api/market-provider";
import { buildSectorCounts } from "@/lib/data/stock-directory-filters";
import { getDirectoryMeta, getEquityDirectoryCount } from "@/lib/data/stock-directory";
import { getStockDirectoryEntries } from "@/lib/data/stock-directory-server";
import { getStocksMarketPriceNote } from "@/lib/data/stocks-market-note";
import { getPseSectors } from "@/lib/pse/universe";
import { slugToSector } from "@/lib/pse/sector-slug";

type StocksPageProps = {
  searchParams: Promise<{
    sector?: string;
    subsector?: string;
    q?: string;
  }>;
};

function resolveSectorParam(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const decoded = decodeURIComponent(raw);
  if (getPseSectors().includes(decoded)) return decoded;
  return slugToSector(decoded) ?? undefined;
}

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const params = await searchParams;
  const quotes = await getQuotesForSymbols();
  const entries = await getStockDirectoryEntries(quotes);
  const equityCount = getEquityDirectoryCount();
  const meta = getDirectoryMeta();
  const sectorCounts = buildSectorCounts(entries);

  const initialSector = resolveSectorParam(params.sector);
  const initialSubsector = params.subsector
    ? decodeURIComponent(params.subsector)
    : undefined;
  const initialQuery = params.q ?? "";

  const listingNote = `Listings from ${meta.source} (as of ${meta.asOf}).`;
  const marketNote = await getStocksMarketPriceNote();

  return (
    <PageShell>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">All stocks</h1>
        <p className="mt-1 text-muted-foreground">{listingNote}</p>
        {marketNote ? (
          <p className="mt-1 text-sm text-muted-foreground">{marketNote}</p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">
          {equityCount} listed equities in directory ({entries.length} including
          indices). Demo forecasts on select blue-chip tickers only.
        </p>
      </header>
      <MarketDataNotice hasQuotes={quotes.size > 0} />
      <SectorSummary entries={entries} />
      <StockDirectory
        entries={entries}
        sectorCounts={sectorCounts}
        initialQuery={initialQuery}
        initialSector={initialSector}
        initialSubsector={initialSubsector}
      />
    </PageShell>
  );
}
