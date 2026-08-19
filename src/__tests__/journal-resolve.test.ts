import { describe, expect, it } from "vitest";

import { findResolutionPrice } from "@/lib/journal/resolve";

function points(dates: string[]): { date: string; close: number }[] {
  return dates.map((date, i) => ({ date, close: 100 + i }));
}

describe("findResolutionPrice", () => {
  it("resolves against the price exactly horizonDays trading days later", () => {
    const p = points([
      "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
      "2026-01-12", "2026-01-13", "2026-01-14",
    ]);
    const result = findResolutionPrice(p, "2026-01-05", 3);
    expect(result).toEqual({ resolvedAt: "2026-01-08", actualPrice: 103 });
  });

  it("treats the first point on or after loggedAt as day 0 (weekend/holiday-safe)", () => {
    const p = points(["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
    // 2026-01-04 is a Sunday with no bar — should fall to 2026-01-05 as day 0.
    const result = findResolutionPrice(p, "2026-01-04", 2);
    expect(result).toEqual({ resolvedAt: "2026-01-07", actualPrice: 102 });
  });

  it("returns null when there isn't enough future data yet", () => {
    const p = points(["2026-01-05", "2026-01-06", "2026-01-07"]);
    expect(findResolutionPrice(p, "2026-01-05", 7)).toBeNull();
  });

  it("returns null when loggedAt is after every available point", () => {
    const p = points(["2026-01-05", "2026-01-06"]);
    expect(findResolutionPrice(p, "2026-03-01", 3)).toBeNull();
  });

  it("sorts unsorted input before resolving", () => {
    const p = points(["2026-01-08", "2026-01-05", "2026-01-07", "2026-01-06"]);
    const result = findResolutionPrice(p, "2026-01-05", 1);
    expect(result?.resolvedAt).toBe("2026-01-06");
  });
});
