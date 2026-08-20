import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Regression coverage for the WCAG contrast fixes made in the UI/UX audit
// (settings correctness, watchlist UX, stock page tabs, forecast trust).
// That audit fixed real issues by hand with no automated check behind it,
// so a future style change could silently reintroduce a contrast or
// labeling violation. This scans the app's main surfaces against WCAG
// 2.1 A/AA rules on every run instead of relying on another manual pass.
const pages = [
  { path: "/", name: "landing" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/stocks", name: "stocks directory" },
  { path: "/watchlist", name: "watchlist" },
  { path: "/forecasts", name: "forecasts" },
  { path: "/settings", name: "settings" },
  { path: "/terms", name: "terms" },
  { path: "/stock/bdo", name: "stock detail" },
];

test.describe("accessibility", () => {
  for (const { path, name } of pages) {
    test(`${name} page (${path}) has no WCAG 2.1 A/AA violations`, async ({
      page,
    }) => {
      await page.goto(path);
      // Every (app) route mounts through a 200ms fade-in entrance animation
      // (src/app/(app)/template.tsx). Scanning mid-fade briefly measures
      // text at reduced effective opacity/contrast — a transient rendering
      // artifact, not the page's real (fully compliant) steady-state
      // color — so wait for the animation to settle first. No-op on
      // routes without the wrapper (e.g. "/").
      const animatedRoot = page.locator(".animate-in.fade-in").first();
      if (await animatedRoot.count()) {
        await expect(animatedRoot).toHaveCSS("opacity", "1");
      }
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
    });
  }
});
