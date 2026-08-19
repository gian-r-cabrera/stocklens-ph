import { describe, expect, it } from "vitest";

import { journalStats, resolvedEntriesToTrials } from "@/lib/journal/stats";
import type { JournalEntry } from "@/lib/journal/types";

function entry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: "1",
    ticker: "BDO.PS",
    companyName: "BDO Unibank",
    loggedAt: "2026-01-05",
    action: "buy",
    confidence: 50,
    horizonDays: 7,
    entryPrice: 100,
    stopLoss: 95,
    target: 110,
    rationale: "test",
    status: "pending",
    resolvedAt: null,
    actualPrice: null,
    actualReturnPct: null,
    ...overrides,
  };
}

describe("resolvedEntriesToTrials", () => {
  it("only includes resolved entries with a non-null actualReturnPct", () => {
    const entries = [
      entry({ id: "a", status: "resolved", actualReturnPct: 2.5 }),
      entry({ id: "b", status: "pending" }),
      entry({ id: "c", status: "resolved", actualReturnPct: null }),
    ];
    const trials = resolvedEntriesToTrials(entries);
    expect(trials).toHaveLength(1);
    expect(trials[0]).toEqual({
      date: "2026-01-05",
      action: "buy",
      confidence: 50,
      forwardReturnPct: 2.5,
    });
  });
});

describe("journalStats", () => {
  it("matches aggregateTrials' output for the mapped trials", () => {
    const entries = [
      entry({ id: "a", action: "buy", status: "resolved", actualReturnPct: 3 }),
      entry({ id: "b", action: "avoid", status: "resolved", actualReturnPct: -2 }),
    ];
    const stats = journalStats(entries);
    expect(stats.byAction.buy.count).toBe(1);
    expect(stats.byAction.buy.avgReturnPct).toBeCloseTo(3, 5);
    expect(stats.byAction.avoid.count).toBe(1);
    expect(stats.byAction.avoid.hitRate).toBeCloseTo(100, 5);
    expect(stats.baselineAvgReturnPct).toBeCloseTo(0.5, 5);
  });

  it("returns empty stats when nothing is resolved", () => {
    const entries = [entry({ status: "pending" })];
    const stats = journalStats(entries);
    expect(stats.byAction.buy.count).toBe(0);
    expect(stats.baselineAvgReturnPct).toBeNull();
  });
});
