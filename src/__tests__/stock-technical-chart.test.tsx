import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockTechnicalChart } from "@/components/stock/stock-technical-chart";
import type { IndicatorPoint } from "@/lib/market/indicators";

// Regression coverage for a bug where the Technical tab's forecast overlay
// never rendered for any stock: forecastPoints (analysis.chartData) keys
// dates as short labels ("Jul 24"), while indicator points from the API use
// ISO dates ("2026-07-24") — the two arrays never shared a key, so the
// forecast line's data was always empty. It was also missing rows entirely,
// since forecast dates always fall after the last indicator point.

function point(overrides: Partial<IndicatorPoint>): IndicatorPoint {
  return {
    date: "2026-07-22",
    close: 100,
    volume: 1000,
    sma20: null,
    sma50: null,
    rsi14: null,
    macd: null,
    macdSignal: null,
    macdHist: null,
    atr14: null,
    ...overrides,
  };
}

describe("StockTechnicalChart forecast overlay", () => {
  it("renders a non-empty forecast line even though indicator and forecast dates never overlap", () => {
    const points: IndicatorPoint[] = [
      point({ date: "2026-07-21", close: 120 }),
      point({ date: "2026-07-22", close: 122 }),
    ];
    // Mirrors analysis.chartData's shape: short-format dates strictly after
    // the last indicator date, with price null (forecast-only rows).
    const forecastPoints = [
      { date: "Jul 23", forecast: 123 },
      { date: "Jul 24", forecast: 124 },
    ];

    const { container } = render(
      <StockTechnicalChart points={points} forecastPoints={forecastPoints} />,
    );

    const forecastLine = container.querySelector(
      'path.recharts-curve[stroke="var(--chart-4)"]',
    );
    expect(forecastLine).not.toBeNull();
    expect(forecastLine!.getAttribute("d")?.length).toBeGreaterThan(0);
  });

  it("renders nothing on the forecast line when no forecast points are supplied", () => {
    const points: IndicatorPoint[] = [point({ date: "2026-07-22", close: 122 })];

    const { container } = render(<StockTechnicalChart points={points} />);

    const forecastLine = container.querySelector(
      'path.recharts-curve[stroke="var(--chart-4)"]',
    );
    expect(forecastLine?.getAttribute("d") ?? "").toBe("");
  });
});
