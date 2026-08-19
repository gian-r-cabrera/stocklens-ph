import { describe, expect, it } from "vitest";

import { filterStockDirectory, getEquityDirectoryCount } from "@/lib/data/stock-directory";
import { getStockDirectoryEntries } from "@/lib/data/stock-directory-server";

describe("stock directory", () => {
  it("includes full PSE listings", async () => {
    const entries = await getStockDirectoryEntries();
    expect(getEquityDirectoryCount()).toBeGreaterThanOrEqual(200);
    expect(entries.length).toBeGreaterThan(getEquityDirectoryCount());
  });

  it("filters by sector and subsector", async () => {
    const entries = await getStockDirectoryEntries();
    const financials = filterStockDirectory(entries, "", "Financials", "all");
    expect(financials.length).toBeGreaterThan(5);
    expect(financials.every((e) => e.sector === "Financials")).toBe(true);

    const banks = filterStockDirectory(
      entries,
      "",
      "Financials",
      "Banks",
    );
    if (banks.length > 0) {
      expect(banks.every((e) => e.subsector === "Banks")).toBe(true);
    }
  });
});
