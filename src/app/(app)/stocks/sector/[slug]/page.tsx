import { notFound } from "next/navigation";

import { MarketDataNotice } from "@/components/stocks/market-data-notice";
import { StockDirectory } from "@/components/stocks/stock-directory";
import { PageShell } from "@/components/layout/page-shell";
import { getQuotesForSymbols } from "@/lib/api/market-provider";
import { buildSectorCounts } from "@/lib/data/stock-directory-filters";
import { getDirectoryMeta } from "@/lib/data/stock-directory";
import { getStockDirectoryEntries } from "@/lib/data/stock-directory-server";
import { getStocksMarketPriceNote } from "@/lib/data/stocks-market-note";
import { getAllSectorSlugs, slugToSector } from "@/lib/pse/sector-slug";

type SectorPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllSectorSlugs().map(({ slug }) => ({ slug }));
}

export default async function SectorStocksPage({ params }: SectorPageProps) {
  const { slug } = await params;
  const sector = slugToSector(slug);
  if (!sector) notFound();

  const quotes = await getQuotesForSymbols();
  const entries = await getStockDirectoryEntries(quotes);
  const meta = getDirectoryMeta();
  const sectorCounts = buildSectorCounts(entries);
  const marketNote = await getStocksMarketPriceNote();

  return (
    <PageShell>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{sector}</h1>
        <p className="mt-1 text-muted-foreground">
          Listings from {meta.source} (as of {meta.asOf}).
        </p>
        {marketNote ? (
          <p className="mt-1 text-sm text-muted-foreground">{marketNote}</p>
        ) : null}
      </header>
      <MarketDataNotice hasQuotes={quotes.size > 0} />
      <StockDirectory
        entries={entries}
        sectorCounts={sectorCounts}
        initialSector={sector}
      />
    </PageShell>
  );
}
