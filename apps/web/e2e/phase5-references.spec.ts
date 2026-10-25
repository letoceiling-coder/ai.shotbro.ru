import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { seedScriptScene, uploadTinyImage } from "./helpers/phase5-creative-seed";

const viewports = [
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5F reference manager", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loginRealUser(page);
    loggedInStorage = await context.storageState();
    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    if (loggedInStorage?.cookies.length) await context.addCookies(loggedInStorage.cookies);
  });

  for (const vp of viewports) {
    test(`Reference attach + reload @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      await seedScriptScene(page, projectId);
      const assetId = await uploadTinyImage(page, projectId);

      await page.reload({ waitUntil: "domcontentloaded" });
      await pinRealProjectOnReload(page, projectId, "references");
      await page.goto("/studio", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("reference-manager")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("reference-role").click();
      await page.getByRole("option", { name: "FIRST_FRAME" }).click();
      await page.getByTestId("reference-attach-open").click();
      await expect(page.getByTestId("asset-picker-dialog")).toBeVisible();
      await page.screenshot({ path: `test-results/phase5-reference-picker-${vp.name}.png`, fullPage: true });
      await page.getByTestId(`asset-pick-${assetId}`).click();

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/references`);
          const j = (await r.json()) as { items?: Array<{ assetId: string; role: string }> };
          return j.items?.some((l) => l.assetId === assetId && l.role === "FIRST_FRAME") ?? false;
        }, { timeout: 25_000 })
        .toBe(true);

      await page.reload({ waitUntil: "domcontentloaded" });
      await pinRealProjectOnReload(page, projectId, "references");
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("reference-list")).toContainText("FIRST_FRAME");
    });
  }
});
