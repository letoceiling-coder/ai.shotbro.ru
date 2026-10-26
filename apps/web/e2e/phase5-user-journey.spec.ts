import { test, expect } from "@playwright/test";
import { applyRealAuthOnce } from "./helpers/real-auth-once";

/**
 * Strict REAL user journey (P0 UX recovery).
 * All navigation via /studio UI — no direct deep-links to creative sections.
 */
test.describe("Phase 5 user journey (REAL)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Requires E2E_REAL_BACKEND=1 on staging");

  test.beforeEach(async ({ page, context }) => {
    await applyRealAuthOnce(page, context);
  });

  test("studio REAL mode exposes creative workspace tabs", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("button", { name: "REAL", exact: true }).click();
    await expect(page.getByTestId("creative-workspace")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("creative-section-nav")).toBeVisible();
    for (const id of ["chat", "script", "storyboard", "characters", "references", "prompts", "models", "timeline", "assets"]) {
      await page.getByTestId(`creative-section-${id}`).click();
      await expect(page.getByTestId(`creative-section-${id}`)).toHaveClass(/primary|bg-primary/);
    }
  });
});
