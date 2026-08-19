import { FeaturedStocks } from "@/components/dashboard/featured-stocks";
import { ForecastDisclaimer } from "@/components/dashboard/forecast-disclaimer";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { PseiChart } from "@/components/dashboard/psei-chart-lazy";
import { RecentAnalysisTable } from "@/components/dashboard/recent-analysis-table";
import { StockSearch } from "@/components/dashboard/stock-search";
import { WhatsNewCard } from "@/components/dashboard/whats-new-card";
import { isDbMarketEnabled } from "@/lib/db/config";
import { APP_PAGE_CLASS } from "@/lib/layout";
import { getMarketOverview } from "@/lib/services/market-service";

export default async function DashboardPage() {
  const market = await getMarketOverview();
  const liveQuotesAvailable = isDbMarketEnabled() && !market.dbUnreachable;

  return (
    <div className={APP_PAGE_CLASS}>
      <StockSearch />
      <WhatsNewCard />
      {market.dbUnreachable ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Database unreachable — showing static snapshot. Fix{" "}
          <code className="text-xs">DATABASE_URL</code> in{" "}
          <code className="text-xs">.env.local</code> (full host:{" "}
          <code className="text-xs">aws-1-ap-southeast-1.pooler...</code>
          ), run <code className="text-xs">npm run health:market</code>, then
          restart dev.
        </p>
      ) : null}
      {market.quotesAsOf ? (
        <p className="text-sm text-muted-foreground">
          Market prices as of {market.quotesAsOf}
          {market.stale ? " · data may be stale" : ""}
        </p>
      ) : null}
      <MarketOverview data={market.overview} liveQuotesAvailable={liveQuotesAvailable} />
      <FeaturedStocks stocks={market.featured} liveQuotesAvailable={liveQuotesAvailable} />
      <PseiChart data={market.pseiChart} />
      <RecentAnalysisTable rows={market.recent} />
      <ForecastDisclaimer />
    </div>
  );
}
