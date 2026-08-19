"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { TrendBadge } from "@/components/ui/trend-badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForecastsTabSummary } from "@/components/forecasts/forecasts-tab-summary";
import type { ModelPerformance, StockForecast } from "@/lib/data/forecasts";
import { isDownwardTrend, isUpwardTrend, tickerToPath } from "@/lib/forecast";
import type { ForecastsPayload } from "@/lib/api/market-provider/types";

type ForecastTableProps = {
  forecasts: StockForecast[];
  caption: string;
  showSector?: boolean;
  showExpectedChange?: boolean;
  expectedChangeLabel?: string;
};

function ForecastTable({
  forecasts,
  caption,
  showSector = true,
  showExpectedChange = false,
  expectedChangeLabel = "Expected Change",
}: ForecastTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            {showSector && <TableHead>Sector</TableHead>}
            <TableHead>Current Price</TableHead>
            <TableHead>7-Day Forecast</TableHead>
            {showExpectedChange ? (
              <TableHead>{expectedChangeLabel}</TableHead>
            ) : (
              <TableHead>Trend</TableHead>
            )}
            <TableHead>Accuracy</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forecasts.map((forecast) => (
            <TableRow key={forecast.ticker}>
              <TableCell className="max-w-[180px] font-medium">
                <div>{forecast.ticker}</div>
                <div className="truncate text-xs font-normal text-muted-foreground">
                  {forecast.company}
                </div>
              </TableCell>
              {showSector && (
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {forecast.sector}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="tabular-nums">{forecast.currentPrice}</TableCell>
              <TableCell
                className={cn(
                  "tabular-nums font-medium",
                  showExpectedChange &&
                    isUpwardTrend(forecast.trend) &&
                    "text-trend-up",
                  showExpectedChange &&
                    isDownwardTrend(forecast.trend) &&
                    "text-trend-down",
                )}
              >
                {forecast.forecast7d}
              </TableCell>
              {showExpectedChange ? (
                <TableCell
                  className={cn(
                    "tabular-nums font-medium",
                    isUpwardTrend(forecast.trend) && "text-trend-up",
                    isDownwardTrend(forecast.trend) && "text-trend-down",
                  )}
                >
                  {forecast.expectedChange ?? "—"}
                </TableCell>
              ) : (
                <TableCell>
                  <TrendBadge trend={forecast.trend} />
                </TableCell>
              )}
              <TableCell className="tabular-nums">{forecast.accuracy}</TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/stock/${tickerToPath(forecast.ticker)}`}
                  aria-label={`Analyze ${forecast.ticker}`}
                >
                  <Button variant="default" size="sm">
                    Analyze
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ForecastCard({
  forecast,
  showSector = true,
  showExpectedChange = false,
  expectedChangeLabel = "Expected Change",
}: {
  forecast: StockForecast;
} & Pick<ForecastTableProps, "showSector" | "showExpectedChange" | "expectedChangeLabel">) {
  return (
    <Card className="card-interactive">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{forecast.ticker}</CardTitle>
            <CardDescription className="text-xs">{forecast.company}</CardDescription>
          </div>
          {showSector ? (
            <Badge variant="outline" className="shrink-0 text-xs">
              {forecast.sector}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="tabular-nums text-xl font-semibold">
            {forecast.currentPrice}
          </span>
          <span
            className={cn(
              "tabular-nums text-sm font-medium",
              showExpectedChange &&
                isUpwardTrend(forecast.trend) &&
                "text-trend-up",
              showExpectedChange &&
                isDownwardTrend(forecast.trend) &&
                "text-trend-down",
            )}
          >
            {forecast.forecast7d}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          {showExpectedChange ? (
            <span
              className={cn(
                "tabular-nums font-medium",
                isUpwardTrend(forecast.trend) && "text-trend-up",
                isDownwardTrend(forecast.trend) && "text-trend-down",
              )}
            >
              {expectedChangeLabel}: {forecast.expectedChange ?? "—"}
            </span>
          ) : (
            <TrendBadge trend={forecast.trend} className="text-xs" />
          )}
          <span className="tabular-nums text-muted-foreground">
            Accuracy: {forecast.accuracy}
          </span>
        </div>
        <Link href={`/stock/${tickerToPath(forecast.ticker)}`} className="block">
          <Button variant="outline" size="sm" className="w-full">
            Analyze
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ForecastCards({
  forecasts,
  showSector = true,
  showExpectedChange = false,
  expectedChangeLabel = "Expected Change",
}: ForecastTableProps) {
  return (
    <div className="grid gap-4 md:hidden">
      {forecasts.map((forecast) => (
        <ForecastCard
          key={forecast.ticker}
          forecast={forecast}
          showSector={showSector}
          showExpectedChange={showExpectedChange}
          expectedChangeLabel={expectedChangeLabel}
        />
      ))}
    </div>
  );
}

function ForecastList(props: ForecastTableProps) {
  return (
    <>
      <ForecastTable {...props} />
      <ForecastCards {...props} />
    </>
  );
}

type ForecastsTabsProps = {
  forecasts: StockForecast[];
  modelPerformance: ModelPerformance[];
  summary: ForecastsPayload["summary"];
};

export function ForecastsTabs({
  forecasts,
  modelPerformance,
  summary,
}: ForecastsTabsProps) {
  const [tab, setTab] = useState("all");
  const upwardForecasts = forecasts.filter((f) => isUpwardTrend(f.trend));
  const downwardForecasts = forecasts.filter((f) => isDownwardTrend(f.trend));
  const bestModel = modelPerformance.length
    ? modelPerformance.reduce((best, m) =>
        Number.parseFloat(m.avgAccuracy) > Number.parseFloat(best.avgAccuracy)
          ? m
          : best,
      )
    : null;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value ?? "all")}
      className="space-y-4"
    >
      <TabsList className="sticky top-0 z-10 w-full justify-start overflow-x-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <TabsTrigger value="all">All Forecasts</TabsTrigger>
        <TabsTrigger value="upward">Projected Upward</TabsTrigger>
        <TabsTrigger value="downward">Projected Downward</TabsTrigger>
        <TabsTrigger value="performance">Model Performance</TabsTrigger>
      </TabsList>

      <ForecastsTabSummary
        tab={tab}
        upwardCount={upwardForecasts.length}
        downwardCount={downwardForecasts.length}
        summary={summary}
      />

      <TabsContent value="all" className="space-y-4">
        <Card className="card-interactive">
          <CardHeader>
            <CardTitle>All Stock Forecasts</CardTitle>
            <CardDescription>7-day price forecasts using the linear regression model</CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastList
              forecasts={forecasts}
              caption="All stock forecasts"
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="upward" className="space-y-4">
        <Card className="card-interactive">
          <CardHeader>
            <CardTitle>Projected Upward Forecasts</CardTitle>
            <CardDescription>
              Stocks with predicted upward movement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastList
              forecasts={upwardForecasts}
              caption="Projected upward stock forecasts"
              showSector={false}
              showExpectedChange
              expectedChangeLabel="Expected Gain"
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="downward" className="space-y-4">
        <Card className="card-interactive">
          <CardHeader>
            <CardTitle>Projected Downward Forecasts</CardTitle>
            <CardDescription>
              Stocks with predicted downward movement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastList
              forecasts={downwardForecasts}
              caption="Projected downward stock forecasts"
              showSector={false}
              showExpectedChange
              expectedChangeLabel="Expected Loss"
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="performance" className="space-y-4">
        <Card className="card-interactive">
          <CardHeader>
            <CardTitle>Model Performance Comparison</CardTitle>
            <CardDescription>
              Average performance metrics across all forecasts
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">
                Model performance comparison
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Avg MAE</TableHead>
                  <TableHead>Avg RMSE</TableHead>
                  <TableHead>Avg MAPE</TableHead>
                  <TableHead>Avg Accuracy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelPerformance.map((model) => (
                  <TableRow key={model.model}>
                    <TableCell className="font-medium">{model.model}</TableCell>
                    <TableCell>{model.avgMAE}</TableCell>
                    <TableCell>{model.avgRMSE}</TableCell>
                    <TableCell>{model.avgMAPE}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          model.model === bestModel?.model ? "default" : "secondary"
                        }
                      >
                        {model.avgAccuracy}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {bestModel ? (
              <p>
                The <strong>{bestModel.model}</strong> model currently has the
                strongest average directional accuracy of the models compared
                here, at <strong>{bestModel.avgAccuracy}</strong>.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Model performance data isn&apos;t available yet.
              </p>
            )}
            <p className="text-muted-foreground">
              Users should combine these forecasts with fundamental analysis,
              technical indicators, and market context before making any
              investment decisions.
            </p>
            <p className="text-muted-foreground">
              Model performance varies by sector, with Financials and Consumer
              stocks showing higher accuracy compared to more volatile sectors
              like Real Estate.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
