"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tickerToPath } from "@/lib/forecast";
import type { IndicatorPoint } from "@/lib/market/indicators";
import type { StockAnalysis } from "@/lib/types/stock-analysis";
import type { TechnicalPanelKey } from "@/components/stock/stock-technical-chart";

const StockTechnicalChart = dynamic(
  () =>
    import("@/components/stock/stock-technical-chart").then(
      (m) => m.StockTechnicalChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[720px] animate-pulse rounded-lg border bg-muted/30" />
    ),
  },
);

const PANEL_OPTIONS: { key: TechnicalPanelKey; label: string }[] = [
  { key: "price", label: "Price + SMA" },
  { key: "volume", label: "Volume" },
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
  { key: "atr", label: "ATR" },
];

export function StockTechnicalSection({
  analysis,
}: {
  analysis: StockAnalysis;
}) {
  const [range, setRange] = useState("90d");
  const [points, setPoints] = useState<IndicatorPoint[]>([]);
  const [loadedRange, setLoadedRange] = useState<string | null>(null);
  const [visiblePanels, setVisiblePanels] = useState<Set<TechnicalPanelKey>>(
    () => new Set(PANEL_OPTIONS.map((p) => p.key)),
  );
  const loading = loadedRange !== range;

  const togglePanel = (key: TechnicalPanelKey) => {
    setVisiblePanels((prev) => {
      // Always keep at least one panel visible.
      if (prev.has(key) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const path = tickerToPath(analysis.info.ticker);
    fetch(`/api/stocks/${path}/indicators?range=${range}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ points: IndicatorPoint[] }>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data) setPoints(data.points);
        setLoadedRange(range);
      });
    return () => {
      cancelled = true;
    };
  }, [range, analysis.info.ticker]);

  const isIndex = analysis.info.sector === "Index";

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl">Technical Analysis</CardTitle>
            <CardDescription className="mt-1">
              SMA, volume, RSI, and MACD computed from daily OHLCV bars.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Range:</span>
            <Select value={range} onValueChange={(v) => v && setRange(v)}>
              <SelectTrigger className="w-28" aria-label="Technical analysis range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="1y">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          {PANEL_OPTIONS.map(({ key, label }) => {
            const active = visiblePanels.has(key);
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={active ? "secondary" : "outline"}
                aria-pressed={active}
                onClick={() => togglePanel(key)}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <div className="relative">
          <StockTechnicalChart
            points={points}
            isIndex={isIndex}
            forecastPoints={analysis.chartData}
            visiblePanels={visiblePanels}
            support={analysis.entryExitPlan?.support ?? null}
            resistance={analysis.entryExitPlan?.resistance ?? null}
          />
          {loading ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/50"
              aria-busy="true"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
