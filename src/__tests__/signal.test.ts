import { describe, expect, it } from "vitest";

import { trendFromPrices } from "@/lib/forecast";
import { predictWithModel } from "@/lib/forecast/models";
import { BASELINE_MODELS } from "@/lib/forecast/types";
import {
  MIN_CLOSES_FOR_SIGNAL,
  computeConsensusSignal,
  consensusTargetPrice,
} from "@/lib/signal/consensus";
import { computeEntryExitPlan } from "@/lib/signal/entry-exit";
import type { ModelVote } from "@/lib/signal/types";

function uptrendCloses(n = 40): number[] {
  return Array.from({ length: n }, (_, i) => 100 + i);
}

describe("computeConsensusSignal", () => {
  it("returns hold with dataSufficient=false below the minimum close count", () => {
    const closes = Array.from({ length: MIN_CLOSES_FOR_SIGNAL - 1 }, (_, i) => 100 + i);
    const signal = computeConsensusSignal(closes, 7, []);
    expect(signal.dataSufficient).toBe(false);
    expect(signal.action).toBe("hold");
    expect(signal.confidence).toBe(0);
    expect(signal.votes).toHaveLength(0);
  });

  it("falls back to equal weighting and caps confidence when no model has usable accuracy", () => {
    const signal = computeConsensusSignal(uptrendCloses(), 7, []);
    expect(signal.dataSufficient).toBe(true);
    expect(signal.fallback).toBe(true);
    expect(signal.confidence).toBeLessThanOrEqual(34);
    expect(signal.votes).toHaveLength(3);
    expect(signal.votes.every((v) => v.weight === 1)).toBe(true);
  });

  it("weights votes by backtested directional accuracy, matching the manual weighted-score formula", () => {
    const closes = uptrendCloses();
    const metrics = [
      { model: "naive" as const, dirAccuracy: 50 },
      { model: "ma" as const, dirAccuracy: 55 },
      { model: "linear" as const, dirAccuracy: 90 },
    ];
    const signal = computeConsensusSignal(closes, 7, metrics);
    expect(signal.fallback).toBe(false);

    const lastClose = closes.at(-1)!;
    const expectedWeights: Record<string, number> = { naive: 0, ma: 0.1, linear: 0.8 };
    let weightedSum = 0;
    let weightSum = 0;
    for (const model of BASELINE_MODELS) {
      const forecastPrice = predictWithModel(model, closes, 7).at(-1)!;
      const trend = trendFromPrices(lastClose, forecastPrice);
      const direction = trend === "Projected Upward" ? 1 : trend === "Projected Downward" ? -1 : 0;
      const w = expectedWeights[model]!;
      weightedSum += w * direction;
      weightSum += w;
    }
    const expectedScore = weightSum === 0 ? 0 : weightedSum / weightSum;
    expect(signal.score).toBeCloseTo(expectedScore, 5);
  });

  it("never assigns a nonzero direction to the naive model (always predicts flat)", () => {
    const signal = computeConsensusSignal(uptrendCloses(), 7, [
      { model: "naive", dirAccuracy: 80 },
      { model: "ma", dirAccuracy: 80 },
      { model: "linear", dirAccuracy: 80 },
    ]);
    expect(signal.votes.find((v) => v.model === "naive")?.direction).toBe(0);
  });

  it("floors sub-50% directional accuracy at zero weight instead of inverting it", () => {
    const signal = computeConsensusSignal(uptrendCloses(), 7, [
      { model: "naive", dirAccuracy: 20 },
      { model: "ma", dirAccuracy: 80 },
      { model: "linear", dirAccuracy: 80 },
    ]);
    expect(signal.votes.find((v) => v.model === "naive")?.weight).toBe(0);
  });
});

describe("consensusTargetPrice", () => {
  const votes: ModelVote[] = [
    { model: "naive", direction: 0, weight: 0, dirAccuracy: null, forecastPrice: 100 },
    { model: "ma", direction: 1, weight: 0.5, dirAccuracy: 80, forecastPrice: 110 },
    { model: "linear", direction: 1, weight: 0.5, dirAccuracy: 80, forecastPrice: 120 },
  ];

  it("computes a weight-normalized average of vote forecast prices", () => {
    expect(consensusTargetPrice(votes)).toBeCloseTo(115, 5);
  });

  it("returns null for an empty vote list", () => {
    expect(consensusTargetPrice([])).toBeNull();
  });
});

describe("computeEntryExitPlan", () => {
  it("returns null for an avoid signal", () => {
    expect(computeEntryExitPlan("avoid", 100, 2, null, null, 130)).toBeNull();
  });

  it("sizes the stop-loss at 2x ATR below entry for a buy signal", () => {
    const plan = computeEntryExitPlan("buy", 100, 2, null, { date: "2026-01-01", price: 115 }, 130);
    expect(plan?.entry).toBe(100);
    expect(plan?.stopLoss).toBeCloseTo(96, 5);
    expect(plan?.riskPerShare).toBeCloseTo(4, 5);
    expect(plan?.atrFallback).toBe(false);
  });

  it("falls back to a 3% stop when ATR is unavailable", () => {
    const plan = computeEntryExitPlan("buy", 100, null, null, null, null);
    expect(plan?.atrFallback).toBe(true);
    expect(plan?.stopLoss).toBeCloseTo(97, 5);
  });

  it("caps the target at resistance when it sits below the model consensus forecast", () => {
    const plan = computeEntryExitPlan("buy", 100, 2, null, { date: "2026-01-01", price: 115 }, 130);
    expect(plan?.target).toBe(115);
    expect(plan?.targetSource).toBe("resistance");
  });

  it("uses the model consensus forecast as target when no valid resistance exists", () => {
    const plan = computeEntryExitPlan("buy", 100, 2, null, null, 130);
    expect(plan?.target).toBe(130);
    expect(plan?.targetSource).toBe("forecast");
  });

  it("returns a null target when neither resistance nor forecast clears the entry price", () => {
    const plan = computeEntryExitPlan(
      "buy",
      100,
      2,
      null,
      { date: "2026-01-01", price: 90 },
      95,
    );
    expect(plan?.target).toBeNull();
    expect(plan?.riskRewardRatio).toBeNull();
  });

  it("enters at a nearby support pullback for a hold signal, but not a distant one", () => {
    const nearSupport = computeEntryExitPlan(
      "hold",
      100,
      2,
      { date: "2026-01-01", price: 95 },
      null,
      null,
    );
    expect(nearSupport?.entry).toBe(95);

    const farSupport = computeEntryExitPlan(
      "hold",
      100,
      2,
      { date: "2026-01-01", price: 80 },
      null,
      null,
    );
    expect(farSupport?.entry).toBe(100);
  });
});
