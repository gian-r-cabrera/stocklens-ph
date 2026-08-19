import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FORECAST_DISCLAIMER } from "@/lib/forecast";

export default function TermsPage() {
  return (
    <div className="container mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold">Terms & Conditions</h1>
        <p className="mt-2 text-muted-foreground">
          Last updated: May 16, 2026
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-medium text-foreground">
          Educational use only
        </h2>
        <p>
          StockLens PH provides experimental market analytics and AI-generated
          forecasts for educational and research purposes. Nothing on this
          platform constitutes financial, investment, tax, or legal advice.
        </p>

        <h2 className="text-lg font-medium text-foreground">
          No warranty on data or forecasts
        </h2>
        <p>
          Prices, historical data, and model outputs may be delayed, incomplete,
          or inaccurate. Past performance does not guarantee future results. Models
          can be wrong, especially during volatile or low-liquidity conditions.
        </p>

        <h2 className="text-lg font-medium text-foreground">Your responsibility</h2>
        <p>
          You are solely responsible for decisions made using information from
          this application. Consult licensed professionals before trading or
          investing.
        </p>

        <p className="rounded-lg border bg-muted/30 p-4 text-foreground">
          {FORECAST_DISCLAIMER}
        </p>

        <h2 className="text-lg font-medium text-foreground">
          PSE listing data
        </h2>
        <p>
          Company names, sectors, and subsectors are sourced from the
          Philippine Stock Exchange EDGE company directory and refreshed
          periodically. StockLens PH is not affiliated with the PSE. Official
          listings are for reference only; prices and forecasts in demo mode
          may not match live market data.
        </p>

        <h2 className="text-lg font-medium text-foreground">
          Market prices (EOD)
        </h2>
        <p>
          When database or snapshot mode is enabled, last prices and daily
          changes come from batch end-of-day ingest via PSE EDGE (or optional
          third-party fallback) stored in Postgres or a local snapshot. Data
          may be delayed, incomplete, or inaccurate versus the PSE official
          feed. Do not rely on displayed prices for trading decisions.
        </p>
      </section>

      <Link href="/settings">
        <Button variant="outline">Back to Settings</Button>
      </Link>
    </div>
  );
}
