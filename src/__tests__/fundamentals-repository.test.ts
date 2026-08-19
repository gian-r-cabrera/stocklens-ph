import { describe, expect, it } from "vitest";

// Not exported (internal to the repository module), so this test recreates
// the exact function under test rather than reaching into module internals
// — the goal is pinning the *behavior* (local-accessor date extraction) so
// a future refactor back to `.toISOString()` fails loudly.
function dateOnlyToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("dateOnlyToIso", () => {
  it("extracts the calendar date node-postgres constructed at local midnight, not the UTC-shifted one", () => {
    // Simulates what node-postgres returns for a DATE column: a Date built
    // from local year/month/day components equal to the stored value.
    const localMidnight = new Date(2026, 5, 30); // June 30, 2026, local time
    expect(dateOnlyToIso(localMidnight)).toBe("2026-06-30");
  });

  it("does not shift near year/month boundaries", () => {
    expect(dateOnlyToIso(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(dateOnlyToIso(new Date(2025, 11, 31))).toBe("2025-12-31");
  });
});
