import Link from "next/link";
import {
  BarChart3,
  Layers,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { PseiChart } from "@/components/dashboard/psei-chart-lazy";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GITHUB_REPO_URL } from "@/lib/constants/site";
import { FORECAST_DISCLAIMER } from "@/lib/forecast";
import { getListedEquityCount } from "@/lib/pse/universe";
import { getMarketOverview } from "@/lib/services/market-service";

export const revalidate = 300;

function buildFeatures(stockCount: number) {
  return [
    {
      icon: TrendingUp,
      title: "Full PSE Coverage",
      description: `Historical data and forecasts for all ${stockCount} PSE-listed companies — not a curated subset.`,
    },
    {
      icon: BarChart3,
      title: "Model Performance, Transparently",
      description:
        "Every forecast ships with its own backtested MAE, RMSE, and directional accuracy — see what actually works, not just a prediction.",
    },
    {
      icon: Layers,
      title: "Multi-Model Forecasting",
      description:
        "Naive, Moving Average, Linear Regression, and LSTM — compare 7-day forecasts across all four side by side.",
    },
    {
      icon: Lightbulb,
      title: "AI Market Insight",
      description:
        "Plain-language explanations of forecast trends and market patterns, computed from live data.",
    },
  ] as const;
}

const pageContainer = "container mx-auto w-full max-w-7xl px-4 md:px-8";

export default async function LandingPage() {
  const [stockCount, market] = await Promise.all([
    getListedEquityCount(),
    getMarketOverview(),
  ]);
  const features = buildFeatures(stockCount);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/40">
      <header className="w-full border-b border-brand-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className={`${pageContainer} flex h-16 items-center`}>
          <BrandLogo className="text-xl" markSize={32} />
          <nav className="ml-auto flex gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="w-full">
        <section className={`${pageContainer} py-20 md:py-28`}>
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h1 className="font-sans text-4xl font-bold tracking-tight md:text-6xl">
              StockLens{" "}
              <span className="text-brand-accent">PH</span>
            </h1>
            <p className="text-xl text-muted-foreground md:text-2xl">
              Explore Philippine stock trends with AI-assisted forecasting and
              model comparison.
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {stockCount} PSE-listed stocks tracked · forecasts updated daily
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Link href="/dashboard">
                <Button size="lg" className="px-8 py-6 text-lg">
                  Start Analyzing
                </Button>
              </Link>
              <Link href="/stock/bdo">
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                  View sample analysis
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className={`${pageContainer} pb-16`}>
          <div className="mx-auto max-w-3xl">
            <PseiChart data={market.pseiChart} />
          </div>
        </section>

        <section className={`${pageContainer} py-16`}>
          <div className="grid w-full gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="card-interactive border-2"
              >
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className={`${pageContainer} py-16`}>
          <div className="mx-auto max-w-3xl">
            <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-yellow-600 dark:text-yellow-500">
                    ⚠️
                  </span>
                  Important Disclaimer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>For educational and research purposes only.</strong>{" "}
                  {FORECAST_DISCLAIMER} Past performance does not guarantee
                  future results.
                </p>
                <p>
                  Always consult with licensed financial advisors before making
                  investment decisions.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="mt-16 w-full border-t">
        <div
          className={`${pageContainer} flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left`}
        >
          <p>© 2026 StockLens PH. Educational tool for stock analysis research.</p>
          <nav className="flex flex-wrap justify-center gap-4 sm:justify-end">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/watchlist" className="hover:text-foreground">
              Watchlist
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
