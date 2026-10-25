import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { gotoStudioSection } from "./helpers/phase5-creative-ui";
import { seedScriptScene } from "./helpers/phase5-creative-seed";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5G prompt studio", () => {
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
    test(`Prompt versioning @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      const sceneId = await seedScriptScene(page, projectId);

      await gotoStudioSection(page, projectId, "prompts");
      await expect(page.getByTestId("prompt-studio")).toBeVisible({ timeout: 20_000 });

      const imagePrompt = `E2E image ${vp.name} ${Date.now()}`;
      await page.getByTestId("prompt-image-text").fill(imagePrompt);
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/prompts") && r.request().method() === "POST" && r.ok(),
          { timeout: 60_000 },
        ),
        page.getByTestId("prompt-save").click(),
      ]);

      await page.getByTestId("prompt-tab-video").click();
      await page.getByTestId("prompt-video-action").fill(`Pan left ${vp.name}`);
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/prompts") && r.request().method() === "POST" && r.ok(),
          { timeout: 60_000 },
        ),
        page.getByTestId("prompt-save").click(),
      ]);

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/scenes/${sceneId}/prompts`);
          const j = (await r.json()) as { items?: Array<{ version: number }> };
          return j.items?.length ?? 0;
        }, { timeout: 20_000 })
        .toBeGreaterThanOrEqual(2);

      await page.getByTestId("prompt-version-1").click();
      await expect(page.getByTestId("prompt-image-text")).toHaveValue(imagePrompt);

      await page.getByTestId("prompt-restore").click();
      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/scenes/${sceneId}/prompts`);
          const j = (await r.json()) as { items?: Array<{ version: number; bundle?: { restoredFromVersion?: number } }> };
          return j.items?.[0]?.bundle?.restoredFromVersion;
        }, { timeout: 20_000 })
        .toBe(1);

      await page.getByTestId("prompt-model-image-select").click();
      await page.getByRole("option", { name: "fal-ai/flux/dev" }).click();
      await page.getByTestId("prompt-validate").click();
      await expect(page.getByText(/Model parameters|unsupported|OK/i)).toBeVisible({ timeout: 10_000 });

      await pinRealProjectOnReload(page, projectId, "prompts");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("prompt-studio")).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/scenes/${sceneId}/prompts/latest`);
          if (!r.ok()) return "";
          const j = (await r.json()) as { bundle?: { image?: { prompt?: string } } };
          return j.bundle?.image?.prompt ?? "";
        }, { timeout: 20_000 })
        .toContain("E2E image");
    });
  }
});
