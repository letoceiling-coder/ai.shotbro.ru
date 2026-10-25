import { mkdirSync } from "node:fs";
import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { gotoStudioSection, uploadImageViaPicker } from "./helpers/phase5-creative-ui";
import { seedScriptScene } from "./helpers/phase5-creative-seed";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5E character studio", () => {
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
    test(`Character version + assign @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      const sceneId = await seedScriptScene(page, projectId);

      await gotoStudioSection(page, projectId, "characters");
      await expect(page.getByTestId("character-studio")).toBeVisible({ timeout: 20_000 });

      await page.getByTestId("character-create").click();
      await page.getByTestId("character-name").fill(`E2E Hero ${vp.name}`);
      await page.locator("textarea").first().fill("Tall, dark hair");
      await page.getByTestId("character-save").click();

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/characters`);
          const j = (await r.json()) as { items?: Array<{ id: string; name: string; version: number }> };
          return j.items?.find((c) => c.name.includes("E2E Hero"));
        }, { timeout: 25_000 })
        .toBeTruthy();

      const chars = (await (await page.request.get(`/api/v1/projects/${projectId}/characters`)).json()) as {
        items: Array<{ id: string; version: number; name: string }>;
      };
      const char = chars.items.find((c) => c.name.includes("E2E Hero"))!;
      const v1 = char.version;

      await page.getByTestId("character-upload-ref").click();
      await uploadImageViaPicker(page);

      await page.getByTestId("character-name").fill(`E2E Hero v2 ${vp.name}`);
      await page.getByTestId("character-save").click();
      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/characters`);
          const j = (await r.json()) as { items?: Array<{ id: string; version: number }> };
          return j.items?.find((c) => c.id === char.id)?.version ?? 0;
        }, { timeout: 20_000 })
        .toBeGreaterThan(v1);

      await page.getByTestId("character-assign-submit").click();
      await expect
        .poll(async () => {
          const board = await page.request.get(`/api/v1/projects/${projectId}/storyboard`);
          const j = (await board.json()) as {
            payload?: { scenes?: Array<{ sceneId: string; characterVersionById?: Record<string, number> }> };
          };
          const s = j.payload?.scenes?.find((x) => x.sceneId === sceneId);
          return s?.characterVersionById?.[char.id] ?? 0;
        }, { timeout: 25_000 })
        .toBeGreaterThan(0);

      const restoreBtn = page.getByRole("button", { name: `v${v1}` });
      if (await restoreBtn.isVisible().catch(() => false)) {
        await restoreBtn.click();
      }

      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "characters");
      await expect(page.getByTestId("character-gallery")).toContainText("E2E Hero");
      await page.screenshot({ path: `test-results/phase5-character-gallery-${vp.name}.png`, fullPage: true });
      await page.screenshot({ path: `test-results/phase5-character-editor-${vp.name}.png`, fullPage: true });
    });
  }
});
