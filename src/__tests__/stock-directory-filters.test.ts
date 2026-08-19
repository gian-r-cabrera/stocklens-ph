import { describe, expect, it } from "vitest";

import type { StockDirectoryEntry } from "@/lib/data/stock-directory";
import {
  buildSectorCounts,
  filterDirectoryByDividendYield,
  filterDirectoryByKind,
  filterDirectoryByPe,
  filterDirectoryByTier,
  sortDirectoryEntries,
} from "@/lib/data/stock-directory-filters";

function entry(
  partial: Partial<StockDirectoryEntry> & Pick<StockDirectoryEntry, "ticker">,
): StockDirectoryEntry {
  return {
    name: partial.ticker,
    sector: "Financials",
    subsector: "Banks",
    path: `/stocks/${partial.ticker.toLowerCase()}`,
    lastClose: "—",
    dailyChange: "—",
    positive: false,
    changeDirection: "flat",
    trend: null,
    hasAnalysis: false,
    kind: "equity",
    lastCloseNum: null,
    changePctNum: null,
    peRatio: null,
    dividendYieldPct: null,
    marketCap: null,
    ...partial,
  };
}

describe("stock-directory-filters", () => {
  it("sorts by ticker", () => {
    const rows = sortDirectoryEntries(
      [entry({ ticker: "ZZZ" }), entry({ ticker: "AAA" })],
      "ticker",
    );
    expect(rows.map((r) => r.ticker)).toEqual(["AAA", "ZZZ"]);
  });

  it("sorts by change percent descending", () => {
    const rows = sortDirectoryEntries(
      [
        entry({ ticker: "A", changePctNum: 1 }),
        entry({ ticker: "B", changePctNum: 5 }),
      ],
      "change",
    );
    expect(rows[0].ticker).toBe("B");
  });

  it("filters analyzed tier", () => {
    const rows = filterDirectoryByTier(
      [
        entry({ ticker: "A", hasAnalysis: true }),
        entry({ ticker: "B", hasAnalysis: false }),
      ],
      "analyzed",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe("A");
  });

  it("filters ETF kind", () => {
    const rows = filterDirectoryByKind(
      [
        entry({ ticker: "AAA", kind: "equity" }),
        entry({ ticker: "FMETF", kind: "etf", sector: "ETF" }),
      ],
      "etf",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe("FMETF");
  });

  it("sorts by P/E ascending with nulls sinking to the bottom", () => {
    const rows = sortDirectoryEntries(
      [
        entry({ ticker: "NODATA", peRatio: null }),
        entry({ ticker: "EXPENSIVE", peRatio: 30 }),
        entry({ ticker: "CHEAP", peRatio: 8 }),
      ],
      "peRatio",
    );
    expect(rows.map((r) => r.ticker)).toEqual(["CHEAP", "EXPENSIVE", "NODATA"]);
  });

  it("sorts by dividend yield descending with nulls sinking to the bottom", () => {
    const rows = sortDirectoryEntries(
      [
        entry({ ticker: "NODATA", dividendYieldPct: null }),
        entry({ ticker: "LOW", dividendYieldPct: 1 }),
        entry({ ticker: "HIGH", dividendYieldPct: 6 }),
      ],
      "dividendYield",
    );
    expect(rows.map((r) => r.ticker)).toEqual(["HIGH", "LOW", "NODATA"]);
  });

  it("filters by P/E threshold, excluding entries with no P/E data", () => {
    const rows = filterDirectoryByPe(
      [
        entry({ ticker: "CHEAP", peRatio: 8 }),
        entry({ ticker: "EXPENSIVE", peRatio: 25 }),
        entry({ ticker: "NODATA", peRatio: null }),
      ],
      "under10",
    );
    expect(rows.map((r) => r.ticker)).toEqual(["CHEAP"]);
  });

  it("filters by minimum dividend yield, excluding entries with no yield data", () => {
    const rows = filterDirectoryByDividendYield(
      [
        entry({ ticker: "HIGH", dividendYieldPct: 5 }),
        entry({ ticker: "LOW", dividendYieldPct: 1 }),
        entry({ ticker: "NODATA", dividendYieldPct: null }),
      ],
      "atLeast4",
    );
    expect(rows.map((r) => r.ticker)).toEqual(["HIGH"]);
  });

  it("builds sector counts", () => {
    const counts = buildSectorCounts([
      entry({ ticker: "A", sector: "Financials" }),
      entry({ ticker: "B", sector: "Financials" }),
      entry({ ticker: "C", sector: "Property" }),
    ]);
    expect(counts.Financials).toBe(2);
    expect(counts.Property).toBe(1);
  });
});
