import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { StockCompanyStats } from "@/components/stock/stock-company-stats";
import { StockDetailTabs } from "@/components/stock/stock-detail-tabs";
import { StockFundamentals } from "@/components/stock/stock-fundamentals";
import { StockHeader } from "@/components/stock/stock-header";
import { StockMetrics } from "@/components/stock/stock-metrics";
import { StockSignalCard } from "@/components/stock/stock-signal-card";
import { pathToTicker } from "@/lib/forecast";
import { isAnalyzedTicker, getPseCompanyByTicker } from "@/lib/pse/universe";
import { getStockAnalysis } from "@/lib/services/stock-service";

type StockPageProps = {
  params: Promise<{ ticker: string }>;
};

export default async function StockPage({ params }: StockPageProps) {
  const { ticker: path } = await params;
  const ticker = pathToTicker(path);
  if (!ticker) {
    notFound();
  }

  const company = getPseCompanyByTicker(ticker);
  if (!company) {
    notFound();
  }

  let analysis;
  try {
    analysis = await getStockAnalysis(ticker);
  } catch {
    notFound();
  }

  const showNarrative = isAnalyzedTicker(ticker);

  return (
    <PageShell>
      <StockHeader analysis={analysis} />
      <StockMetrics analysis={analysis} />
      <StockCompanyStats analysis={analysis} />
      <StockFundamentals analysis={analysis} />
      <StockSignalCard analysis={analysis} />
      <StockDetailTabs analysis={analysis} showNarrative={showNarrative} />
    </PageShell>
  );
}
