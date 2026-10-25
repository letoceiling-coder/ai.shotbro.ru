import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { seedScriptScene, uploadTinyImage } from "./helpers/phase5-creative-seed";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5E character studio", () => {
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
    test(`Character create + assign @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      await seedScriptScene(page, projectId);
      await uploadTinyImage(page, projectId);

      await page.reload({ waitUntil: "domcontentloaded" });
      await pinRealProjectOnReload(page, projectId, "characters");
      await page.goto("/studio", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("character-studio")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("character-create").click();
      await page.getByTestId("character-name").fill("E2E Hero");
      await page.getByTestId("character-save").click();
      await page.screenshot({ path: `test-results/phase5-character-editor-${vp.name}.png`, fullPage: true });

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/characters`);
          const j = (await r.json()) as { items?: Array<{ name: string }> };
          return j.items?.some((c) => c.name === "E2E Hero") ?? false;
        }, { timeout: 20_000 })
        .toBe(true);

      await page.getByTestId("character-assign-submit").click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await pinRealProjectOnReload(page, projectId, "characters");
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("character-gallery")).toContainText("E2E Hero");
      await page.screenshot({ path: `test-results/phase5-character-gallery-${vp.name}.png`, fullPage: true });
    });
  }
});
