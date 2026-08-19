import { describe, expect, it } from "vitest";

import { computeNewlyResolved, computeSignalChanges } from "@/lib/digest/compute";
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

describe("computeSignalChanges", () => {
  it("reports a change when the signal differs from before", () => {
    const before = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: "hold" as const }];
    const after = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: "buy" as const }];
    const changes = computeSignalChanges(before, after);
    expect(changes).toEqual([
      { ticker: "BDO.PS", companyName: "BDO Unibank", from: "hold", to: "buy" },
    ]);
  });

  it("reports nothing for an unchanged signal", () => {
    const before = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: "buy" as const }];
    const after = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: "buy" as const }];
    expect(computeSignalChanges(before, after)).toHaveLength(0);
  });

  it("treats a first-seen ticker as from: null, not a skipped change", () => {
    const before = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: undefined }];
    const after = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: "avoid" as const }];
    expect(computeSignalChanges(before, after)).toEqual([
      { ticker: "BDO.PS", companyName: "BDO Unibank", from: null, to: "avoid" },
    ]);
  });

  it("skips tickers with no current signal", () => {
    const before = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: "buy" as const }];
    const after = [{ ticker: "BDO.PS", name: "BDO Unibank", signal: undefined }];
    expect(computeSignalChanges(before, after)).toHaveLength(0);
  });
});

describe("computeNewlyResolved", () => {
  it("returns everything resolved on a first-ever check (sinceISO null)", () => {
    const entries = [
      entry({ id: "a", status: "resolved", resolvedAt: "2026-01-10" }),
      entry({ id: "b", status: "pending" }),
    ];
    const result = computeNewlyResolved(entries, null);
    expect(result.map((e) => e.id)).toEqual(["a"]);
  });

  it("only includes entries resolved after sinceISO", () => {
    const entries = [
      entry({ id: "a", status: "resolved", resolvedAt: "2026-01-05" }),
      entry({ id: "b", status: "resolved", resolvedAt: "2026-01-15" }),
    ];
    const result = computeNewlyResolved(entries, "2026-01-10");
    expect(result.map((e) => e.id)).toEqual(["b"]);
  });

  it("excludes pending entries even if resolvedAt happens to be set", () => {
    const entries = [entry({ id: "a", status: "pending", resolvedAt: "2026-01-20" })];
    expect(computeNewlyResolved(entries, "2026-01-01")).toHaveLength(0);
  });
});
