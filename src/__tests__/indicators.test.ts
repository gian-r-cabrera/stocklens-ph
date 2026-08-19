import { describe, expect, it } from "vitest";

import { computeIndicators, computeSupportResistance } from "@/lib/market/indicators";
import type { MarketBar } from "@/lib/market/types";

function bar(date: string, close: number, volume = 1000): MarketBar {
  return {
    symbol: "TEST",
    tradeDate: date,
    open: close,
    high: close,
    low: close,
    close,
    volume,
  };
}

function ohlcBar(date: string, high: number, low: number, close: number): MarketBar {
  return { symbol: "TEST", tradeDate: date, open: close, high, low, close, volume: 1000 };
}

describe("computeIndicators", () => {
  it("computes SMA20 after 20 bars", () => {
    const bars = Array.from({ length: 25 }, (_, i) =>
      bar(`2026-01-${String(i + 1).padStart(2, "0")}`, 100 + i),
    );
    const points = computeIndicators(bars);
    expect(points[19]?.sma20).toBeCloseTo(109.5, 1);
    expect(points[18]?.sma20).toBeNull();
  });

  it("computes RSI in 0-100 range", () => {
    const bars = Array.from({ length: 30 }, (_, i) =>
      bar(`2026-02-${String(i + 1).padStart(2, "0")}`, 50 + (i % 3)),
    );
    const points = computeIndicators(bars);
    const last = points.at(-1);
    expect(last?.rsi14).not.toBeNull();
    expect(last!.rsi14!).toBeGreaterThanOrEqual(0);
    expect(last!.rsi14!).toBeLessThanOrEqual(100);
  });

  it("computes MACD after slow period", () => {
    const bars = Array.from({ length: 40 }, (_, i) =>
      bar(`2026-03-${String(i + 1).padStart(2, "0")}`, 100 + Math.sin(i / 3) * 5),
    );
    const points = computeIndicators(bars);
    const last = points.at(-1);
    expect(last?.macd).not.toBeNull();
    expect(last?.macdSignal).not.toBeNull();
    expect(last?.macdHist).not.toBeNull();
  });

  it("computes ATR14 that converges to the true range for a constant-range series", () => {
    const bars = Array.from({ length: 20 }, (_, i) =>
      ohlcBar(`2026-04-${String(i + 1).padStart(2, "0")}`, 101, 99, 100),
    );
    const points = computeIndicators(bars);
    expect(points[13]?.atr14).toBeNull();
    expect(points[14]?.atr14).toBeCloseTo(2, 5);
    expect(points.at(-1)?.atr14).toBeCloseTo(2, 5);
  });
});

describe("computeSupportResistance", () => {
  it("detects a swing low as support when the price forms a V", () => {
    const bars = Array.from({ length: 25 }, (_, i) =>
      bar(`2026-05-${String(i + 1).padStart(2, "0")}`, 100 + Math.abs(i - 12)),
    );
    const { support, resistance } = computeSupportResistance(bars);
    expect(support).not.toBeNull();
    expect(support!.price).toBeCloseTo(100, 5);
    expect(resistance).toBeNull();
  });

  it("detects a swing high as resistance when the price forms a peak", () => {
    const bars = Array.from({ length: 25 }, (_, i) =>
      bar(`2026-06-${String(i + 1).padStart(2, "0")}`, 100 - Math.abs(i - 12)),
    );
    const { support, resistance } = computeSupportResistance(bars);
    expect(resistance).not.toBeNull();
    expect(resistance!.price).toBeCloseTo(100, 5);
    expect(support).toBeNull();
  });
});
