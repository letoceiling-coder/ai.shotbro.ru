import { expect, test } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

test.describe("REAL SSE UI", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
  });

  test("EventSource connects on REAL project thread", async ({ page }) => {
    await loginRealUser(page);
    await openRealNewProject(page);
    await expect(page.getByTestId("real-sse-status")).toContainText("подключено", { timeout: 25_000 });
  });
});
