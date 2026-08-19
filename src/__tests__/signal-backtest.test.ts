import { describe, expect, it } from "vitest";

import {
  aggregateTrials,
  backtestConsensusSignal,
  type SignalBacktestTrial,
} from "@/lib/signal/backtest";
import type { MarketBar } from "@/lib/market/types";

function dateAt(i: number): string {
  const d = new Date("2025-01-01T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
}

function bar(i: number, close: number): MarketBar {
  return { symbol: "TEST", tradeDate: dateAt(i), open: close, high: close, low: close, close, volume: 1000 };
}

function syntheticBars(n: number): MarketBar[] {
  return Array.from({ length: n }, (_, i) => bar(i, 100 + 10 * Math.sin(i / 10) + i * 0.05));
}

describe("backtestConsensusSignal", () => {
  it("never lets future bars influence a historical trial (no lookahead)", () => {
    const bars = syntheticBars(150);
    const full = backtestConsensusSignal(bars, 7, 3);
    const truncated = backtestConsensusSignal(bars.slice(0, 100), 7, 3);

    expect(truncated.trials.length).toBeGreaterThan(0);
    for (const trial of truncated.trials) {
      const match = full.trials.find((t) => t.date === trial.date);
      expect(match).toBeDefined();
      expect(match).toEqual(trial);
    }
  });

  it("returns no trials when there isn't enough history", () => {
    const bars = syntheticBars(20);
    const result = backtestConsensusSignal(bars, 7, 3);
    expect(result.trials).toHaveLength(0);
    expect(result.byAction.buy.count).toBe(0);
    expect(result.baselineAvgReturnPct).toBeNull();
  });

  it("produces trials with plausible forward returns", () => {
    const bars = syntheticBars(150);
    const result = backtestConsensusSignal(bars, 7, 3);
    expect(result.trials.length).toBeGreaterThan(0);
    for (const trial of result.trials) {
      expect(Number.isFinite(trial.forwardReturnPct)).toBe(true);
      expect(["buy", "hold", "avoid"]).toContain(trial.action);
    }
  });
});

describe("aggregateTrials", () => {
  it("computes hit rate and average return per action bucket", () => {
    const trials: SignalBacktestTrial[] = [
      { date: "2026-01-01", action: "buy", confidence: 50, forwardReturnPct: 2 },
      { date: "2026-01-02", action: "buy", confidence: 50, forwardReturnPct: -1.5 },
      { date: "2026-01-03", action: "avoid", confidence: 50, forwardReturnPct: -3 },
      { date: "2026-01-04", action: "hold", confidence: 0, forwardReturnPct: 0.2 },
    ];
    const { byAction, baselineAvgReturnPct } = aggregateTrials(trials);

    expect(byAction.buy.count).toBe(2);
    expect(byAction.buy.hitRate).toBeCloseTo(50, 5);
    expect(byAction.buy.avgReturnPct).toBeCloseTo(0.25, 5);

    expect(byAction.avoid.count).toBe(1);
    expect(byAction.avoid.hitRate).toBeCloseTo(100, 5);

    expect(byAction.hold.count).toBe(1);
    expect(byAction.hold.hitRate).toBeCloseTo(100, 5);

    expect(baselineAvgReturnPct).toBeCloseTo((2 - 1.5 - 3 + 0.2) / 4, 5);
  });

  it("returns null stats for an action with no trials", () => {
    const { byAction, baselineAvgReturnPct } = aggregateTrials([]);
    expect(byAction.buy).toEqual({ count: 0, hitRate: null, avgReturnPct: null });
    expect(baselineAvgReturnPct).toBeNull();
  });
});
