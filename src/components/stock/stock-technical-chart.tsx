"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useIsClient } from "@/lib/hooks/use-is-client";
import { formatStockChartTick } from "@/lib/market/chart-domain";
import type { IndicatorPoint } from "@/lib/market/indicators";

export type TechnicalPanelKey = "price" | "volume" | "rsi" | "macd" | "atr";

// forecastPoints (analysis.chartData) keys its dates as short labels like
// "Jul 24"; indicator points from the API use ISO dates ("2026-07-24") —
// reformat before matching, or the forecast overlay never lines up with any
// indicator point and silently never renders.
function formatBarDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const ALL_TECHNICAL_PANELS: ReadonlySet<TechnicalPanelKey> = new Set([
  "price",
  "volume",
  "rsi",
  "macd",
  "atr",
]);

type StockTechnicalChartProps = {
  points: IndicatorPoint[];
  isIndex?: boolean;
  forecastPoints?: Array<{ date: string; forecast: number | null }>;
  visiblePanels?: ReadonlySet<TechnicalPanelKey>;
  support?: { price: number } | null;
  resistance?: { price: number } | null;
};

function Panel({
  title,
  height,
  children,
}: {
  title: string;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div style={{ height }} className="min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}

export function StockTechnicalChart({
  points,
  isIndex = false,
  forecastPoints = [],
  visiblePanels = ALL_TECHNICAL_PANELS,
  support = null,
  resistance = null,
}: StockTechnicalChartProps) {
  const mounted = useIsClient();

  if (!mounted) {
    return (
      <div className="h-[720px] animate-pulse rounded-lg border bg-muted/30" />
    );
  }

  if (!points.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No bar history yet. Run <code className="mx-1">npm run ingest:bars</code>.
      </div>
    );
  }

  // forecastPoints only covers dates after the last real bar (the forecast
  // horizon), so it can never overlap an existing indicator row — append
  // those as their own rows instead of trying to graft them onto history.
  const priceData = [
    ...points.map((p) => ({ ...p, date: formatBarDate(p.date), forecast: null as number | null })),
    ...forecastPoints
      .filter((p) => p.forecast != null)
      .map((p) => ({
        date: p.date,
        close: null,
        volume: null,
        sma20: null,
        sma50: null,
        rsi14: null,
        macd: null,
        macdSignal: null,
        macdHist: null,
        forecast: p.forecast,
      })),
  ];

  const volumeData = points.map((p) => ({
    date: formatBarDate(p.date),
    volume: p.volume,
  }));

  const rsiData = points
    .filter((p) => p.rsi14 != null)
    .map((p) => ({ ...p, date: formatBarDate(p.date) }));
  const macdData = points
    .filter((p) => p.macd != null)
    .map((p) => ({ ...p, date: formatBarDate(p.date) }));
  const atrData = points
    .filter((p) => p.atr14 != null)
    .map((p) => ({ ...p, date: formatBarDate(p.date) }));

  return (
    <div className="space-y-6" role="img" aria-label="Technical analysis chart">
      {visiblePanels.has("price") ? (
        <Panel title="Price + SMA" height={280}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 400, height: 280 }}
          >
            <ComposedChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={!isIndex}
                tickFormatter={(v) => formatStockChartTick(Number(v), { isIndex })}
              />
              <Tooltip />
              {support ? (
                <ReferenceLine
                  y={support.price}
                  stroke="var(--trend-up)"
                  strokeDasharray="3 3"
                  label={{ value: "Support", position: "insideBottomLeft", fontSize: 10 }}
                />
              ) : null}
              {resistance ? (
                <ReferenceLine
                  y={resistance.price}
                  stroke="var(--trend-down)"
                  strokeDasharray="3 3"
                  label={{ value: "Resistance", position: "insideTopRight", fontSize: 10 }}
                />
              ) : null}
              <Line type="monotone" dataKey="close" stroke="var(--chart-1)" dot={false} name="Close" />
              <Line type="monotone" dataKey="sma20" stroke="var(--chart-2)" dot={false} name="SMA 20" />
              <Line type="monotone" dataKey="sma50" stroke="var(--chart-3)" dot={false} name="SMA 50" />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="var(--chart-4)"
                strokeDasharray="4 4"
                dot={false}
                name="Forecast"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      ) : null}

      {visiblePanels.has("volume") ? (
        <Panel title="Volume" height={120}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 400, height: 120 }}
          >
            <ComposedChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="volume" fill="var(--chart-2)" opacity={0.7} name="Volume" />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      ) : null}

      {visiblePanels.has("rsi") ? (
        <Panel title="RSI (14)" height={120}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 400, height: 120 }}
          >
            <ComposedChart data={rsiData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <ReferenceLine y={30} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
              <ReferenceLine y={70} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
              <Tooltip />
              <Line type="monotone" dataKey="rsi14" stroke="var(--chart-1)" dot={false} name="RSI" />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      ) : null}

      {visiblePanels.has("macd") ? (
        <Panel title="MACD" height={140}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 400, height: 140 }}
          >
            <ComposedChart data={macdData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="macdHist" fill="var(--chart-3)" opacity={0.5} name="Histogram" />
              <Line type="monotone" dataKey="macd" stroke="var(--chart-1)" dot={false} name="MACD" />
              <Line
                type="monotone"
                dataKey="macdSignal"
                stroke="var(--chart-2)"
                dot={false}
                name="Signal"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      ) : null}

      {visiblePanels.has("atr") ? (
        <Panel title="ATR (14)" height={120}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 400, height: 120 }}
          >
            <ComposedChart data={atrData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="atr14" stroke="var(--chart-1)" dot={false} name="ATR" />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      ) : null}
    </div>
  );
}
