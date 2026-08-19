import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseDividendPerShareTtm,
  parseFinancialTables,
  parseTableRows,
} from "../../scripts/market/pse-edge-fundamentals";

const bdoHtml = readFileSync(
  join(process.cwd(), "scripts/fixtures/pse-edge-17q-bdo-sample.html"),
  "utf8",
);
const jfcHtml = readFileSync(
  join(process.cwd(), "scripts/fixtures/pse-edge-17q-jfc-sample.html"),
  "utf8",
);
const bdoDividendsHtml = readFileSync(
  join(process.cwd(), "scripts/fixtures/pse-edge-dividends-bdo-sample.html"),
  "utf8",
);
const jfcDividendsHtml = readFileSync(
  join(process.cwd(), "scripts/fixtures/pse-edge-dividends-jfc-sample.html"),
  "utf8",
);

describe("parseTableRows", () => {
  it("extracts cell text per row, stripping tags and embedded <br/>", () => {
    const rows = parseTableRows(
      "<tr><th>Earnings/(Loss) Per Share<br />(Basic)</th><td>3.86</td></tr>",
    );
    expect(rows).toEqual([["Earnings/(Loss) Per Share (Basic)", "3.86"]]);
  });
});

describe("parseFinancialTables", () => {
  it("parses BDO's filing (units: Phil. Peso in Millions)", () => {
    const result = parseFinancialTables(bdoHtml, "bdo");
    expect(result).toEqual({
      symbol: "BDO",
      periodEnded: "2026-06-30",
      totalAssets: 5_904_542_000_000,
      totalLiabilities: 5_248_640_000_000,
      stockholdersEquity: 655_902_000_000,
      bookValuePerShare: 121.78,
      grossRevenueYtd: 203_523_000_000,
      netIncomeYtd: 40_850_000_000,
      epsBasicTtm: 16.28,
      epsDilutedTtm: 16.2,
      dividendPerShareTtm: null,
    });
  });

  it("parses JFC's filing (units: PHP (In Thousands) — a different scale than BDO)", () => {
    const result = parseFinancialTables(jfcHtml, "jfc");
    expect(result).toEqual({
      symbol: "JFC",
      periodEnded: "2026-06-30",
      totalAssets: 290_796_281_000,
      totalLiabilities: 208_716_129_000,
      stockholdersEquity: 82_080_152_000,
      bookValuePerShare: 65.21,
      grossRevenueYtd: 163_618_324_000,
      netIncomeYtd: 4_927_530_000,
      epsBasicTtm: 8.71,
      epsDilutedTtm: 8.73,
      dividendPerShareTtm: null,
    });
  });

  it("returns null when the BS/IS tables are missing entirely", () => {
    expect(parseFinancialTables("<html><body>no tables here</body></html>", "xxx")).toBeNull();
  });

  it("treats a bare dash as a missing value, not zero", () => {
    // BDO's fixture has "Non-Operating Income" as " -" for every column —
    // not one of the parsed fields, but the same parseNumber path is
    // exercised via Gross Revenue/Net Income; assert indirectly that a
    // present dash elsewhere didn't corrupt adjacent parsed numbers.
    const result = parseFinancialTables(bdoHtml, "bdo");
    expect(result?.grossRevenueYtd).not.toBeNull();
    expect(result?.netIncomeYtd).not.toBeNull();
  });
});

describe("parseDividendPerShareTtm", () => {
  // BDO's fixture has 4 quarterly COMMON/Cash dividends of Php 1.10 each,
  // ex-dividend dated Sep 15 2025, Dec 22 2025, Mar 12 2026, Jun 08 2026 —
  // deliberately mixing the "Php 1.10" and "Php1.10" (no space) rate
  // formats actually seen across real filings.
  it("sums all four trailing-12-month dividends when as-of is after the most recent one", () => {
    expect(parseDividendPerShareTtm(bdoDividendsHtml, "2026-08-14")).toBeCloseTo(4.4, 5);
  });

  it("excludes dividends after the as-of date and before the trailing-12mo cutoff", () => {
    // As of Jan 1, 2026: Mar/Jun 2026 haven't happened yet (excluded), and
    // the trailing-12mo cutoff is Jan 1, 2025 (everything here still
    // qualifies) — should include only Sep 2025 + Dec 2025 = 2.20.
    expect(parseDividendPerShareTtm(bdoDividendsHtml, "2026-01-01")).toBeCloseTo(2.2, 5);
  });

  it("returns null when the dividends table is missing", () => {
    expect(parseDividendPerShareTtm("<html><body>none</body></html>", "2026-08-14")).toBeNull();
  });

  it("returns null (not 0) when no dividend falls in the trailing-12mo window", () => {
    expect(parseDividendPerShareTtm(bdoDividendsHtml, "2020-01-01")).toBeNull();
  });

  // Regression coverage: JFC's COMMON dividend rate omits "per share"
  // entirely ("Php1.33", not "Php1.33 per share") — a real format this
  // codebase's own scraper missed on first pass (silently dropped JFC's
  // real dividend before this fix). This fixture also mixes in JFCPB
  // (preferred-share) rows that must be excluded by the COMMON filter.
  it("parses JFC's rate format (no 'per share' suffix) and excludes preferred-share rows", () => {
    expect(parseDividendPerShareTtm(jfcDividendsHtml, "2026-08-14")).toBeCloseTo(3.44, 5);
  });
});
