import { mkdirSync } from "node:fs";
import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, switchToRealMode } from "./helpers/real-login";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 4F studio UI audit", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    mkdirSync("test-results", { recursive: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loginRealUser(page);
    loggedInStorage = await context.storageState();
    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    if (loggedInStorage?.cookies.length) {
      await context.addCookies(loggedInStorage.cookies);
    }
  });

  for (const vp of viewports) {
    test(`screens DEMO + REAL markers @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      await page.screenshot({ path: `test-results/phase4f-demo-${vp.name}.png`, fullPage: true });
      await expect(page.getByText(/DEMO|Что создадим/i).first()).toBeVisible({ timeout: 15_000 });

      await switchToRealMode(page);
      await page.screenshot({ path: `test-results/phase4f-real-${vp.name}.png`, fullPage: true });
      await expect(
        page.getByRole("button", { name: /Создать проект|Новый проект/i }).first(),
      ).toBeVisible();
    });
  }
});
