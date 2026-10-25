import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5 providers routing (REAL UI)", () => {
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
    if (loggedInStorage?.cookies.length) {
      await context.addCookies(loggedInStorage.cookies);
    }
  });

  for (const vp of viewports) {
    test(`Providers route persist + mock fallback @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);

      const sceneRes = await page.request.post(`/api/v1/projects/${projectId}/scripts/scenes`, {
        data: { title: "E2E scene" },
      });
      expect(sceneRes.ok()).toBeTruthy();
      const sceneBody = (await sceneRes.json()) as { scene?: { id: string } };
      const sceneId = sceneBody.scene?.id;
      expect(sceneId).toBeTruthy();

      await page.getByTestId("creative-section-models").click();
      await expect(page.getByTestId("model-settings-section")).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("provider-route-save-plan").click();
      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/scenes/${sceneId}/provider-route`);
          if (!r.ok()) return "";
          const j = (await r.json()) as { logicalOperation?: { latestStatus?: string } };
          return j.logicalOperation?.latestStatus ?? "";
        }, { timeout: 30_000 })
        .toMatch(/PRIMARY_SELECTED|FALLBACK_PLANNED/);

      await page.getByTestId("provider-route-simulate-failure").click();
      await expect(page.getByTestId("provider-route-status")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("provider-route-timeline")).toBeVisible({ timeout: 30_000 });

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("creative-section-models").click();
      await expect(page.getByTestId("provider-route-status")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("provider-route-timeline")).toBeVisible({ timeout: 20_000 });
    });
  }
});
