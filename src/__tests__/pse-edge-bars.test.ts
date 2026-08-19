import { describe, expect, it, vi, afterEach } from "vitest";

import { fetchPseEdgeHistoricalBars } from "../../scripts/market/pse-edge-bars";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Real PSE EDGE CHART_DATE shape is "Aug 14, 2026 00:00:00" — no
 * timezone marker, and no 'T'/'Z' the way `toISOString()` produces. Using
 * the real shape here (not a plain ISO string) is what actually exercises
 * parseChartDate's real-world parsing path. */
function edgeChartDate(d: Date): string {
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${month} ${day}, ${d.getUTCFullYear()} 00:00:00`;
}

describe("fetchPseEdgeHistoricalBars", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses chartData into daily bars", async () => {
    const recent = new Date();
    recent.setUTCDate(recent.getUTCDate() - 5);
    const chartDate = edgeChartDate(recent);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          chartData: [
            {
              OPEN: 100,
              HIGH: 105,
              LOW: 99,
              CLOSE: 104,
              CHART_DATE: chartDate,
            },
          ],
        }),
      ),
    );

    const bars = await fetchPseEdgeHistoricalBars(
      "BDO",
      "260",
      "468",
      30,
      0,
    );
    expect(bars.length).toBe(1);
    expect(bars[0]?.symbol).toBe("BDO");
    expect(bars[0]?.close).toBe(104);
    expect(bars[0]?.volume).toBeNull();
  });

  // Regression coverage for the Technical tab's Volume chart always being
  // empty: this endpoint has no per-day share volume field, but VALUE
  // (peso value traded) is present and VALUE / CLOSE closely approximates
  // it — verified against PSE EDGE's own real VOLUME for BDO and MG live,
  // within ~0.5%.
  it("approximates volume from VALUE / CLOSE when VALUE is present", async () => {
    const recent = new Date();
    recent.setUTCDate(recent.getUTCDate() - 5);
    const chartDate = edgeChartDate(recent);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          chartData: [
            {
              OPEN: 126.2,
              HIGH: 127,
              LOW: 124.5,
              CLOSE: 124.5,
              VALUE: 483093587,
              CHART_DATE: chartDate,
            },
          ],
        }),
      ),
    );

    const bars = await fetchPseEdgeHistoricalBars("BDO", "260", "468", 30, 0);
    expect(bars[0]?.volume).toBe(Math.round(483093587 / 124.5));
  });

  // Regression coverage for the timezone bug: CHART_DATE has no TZ marker
  // ("Aug 14, 2026 00:00:00"), so `new Date(raw)` parsed it in the
  // runtime's local timezone — `.toISOString()` then shifted the date
  // backward a day in any timezone at or ahead of UTC. A fixed date (not
  // "N days ago") pins this exactly, independent of whatever timezone the
  // test runner happens to be in.
  it("parses CHART_DATE to the exact calendar date, independent of runtime timezone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          chartData: [
            {
              OPEN: 125.5,
              HIGH: 126.9,
              LOW: 125.1,
              CLOSE: 126,
              CHART_DATE: "Aug 14, 2026 00:00:00",
            },
          ],
        }),
      ),
    );

    const bars = await fetchPseEdgeHistoricalBars("BDO", "260", "468", 3650, 0);
    expect(bars[0]?.tradeDate).toBe("2026-08-14");
  });
});
