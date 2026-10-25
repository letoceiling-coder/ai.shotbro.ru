import { mkdirSync } from "node:fs";
import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { seedScriptScene, uploadTinyImage } from "./helpers/phase5-creative-seed";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5D storyboard studio", () => {
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
    if (loggedInStorage?.cookies.length) await context.addCookies(loggedInStorage.cookies);
  });

  for (const vp of viewports) {
    test(`Storyboard grid + first frame persist @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      const sceneId = await seedScriptScene(page, projectId);
      const assetId = await uploadTinyImage(page, projectId);

      await page.reload({ waitUntil: "domcontentloaded" });
      await pinRealProjectOnReload(page, projectId, "storyboard");
      await page.goto("/studio", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("storyboard-studio")).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: `test-results/phase5-storyboard-grid-${vp.name}.png`, fullPage: true });

      await page.getByTestId("storyboard-view-detail").click();
      await expect(page.getByTestId("storyboard-scene-detail")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("storyboard-first-frame").getByRole("button", { name: "Назначить" }).click();
      await expect(page.getByTestId("asset-picker-dialog")).toBeVisible();
      await page.getByTestId(`asset-pick-${assetId}`).click();

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/storyboard`);
          if (!r.ok()) return "";
          const j = (await r.json()) as {
            payload?: { scenes?: Array<{ sceneId: string; firstFrameAssetId?: string }> };
          };
          return j.payload?.scenes?.find((s) => s.sceneId === sceneId)?.firstFrameAssetId ?? "";
        }, { timeout: 30_000 })
        .toBe(assetId);

      await page.reload({ waitUntil: "domcontentloaded" });
      await pinRealProjectOnReload(page, projectId, "storyboard");
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      await page.getByTestId("storyboard-view-detail").click();
      await expect(page.getByTestId("storyboard-first-frame")).toContainText(assetId.slice(0, 8));
      await page.screenshot({ path: `test-results/phase5-storyboard-detail-${vp.name}.png`, fullPage: true });
      void sceneId;
    });
  }
});
