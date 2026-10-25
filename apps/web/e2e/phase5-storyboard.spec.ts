import { test, expect, type BrowserContext } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import {
  addScriptScenesViaUI,
  getStoryboardScene,
  gotoStudioSection,
  saveScriptSceneFields,
  uploadImageViaPicker,
} from "./helpers/phase5-creative-ui";

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
    test(`Storyboard UI persistence @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);

      await gotoStudioSection(page, projectId, "script");
      await addScriptScenesViaUI(page, 2, projectId);
      await saveScriptSceneFields(page, {
        title: `E2E SB ${vp.name}`,
        durationSeconds: 5,
        description: "Script description seed",
      });

      const scriptRes = await page.request.get(`/api/v1/projects/${projectId}/script`);
      const script = (await scriptRes.json()) as { payload?: { scenes?: Array<{ id: string }> } };
      const sceneId = script.payload?.scenes?.[0]?.id;
      expect(sceneId).toBeTruthy();

      await gotoStudioSection(page, projectId, "storyboard");
      await expect(page.getByTestId("storyboard-studio")).toBeVisible({ timeout: 25_000 });
      await expect(page.getByTestId("storyboard-scene-grid")).toBeVisible({ timeout: 20_000 });
      await acceptanceScreenshot(page, `phase5-storyboard-grid-${vp.name}.png`);

      await page.getByTestId("storyboard-view-detail").click();
      await expect(page.getByTestId("storyboard-scene-detail")).toBeVisible();

      await page.getByTestId("storyboard-scene-description").fill(`Board desc ${vp.name}`);
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/storyboard/scenes/") && r.request().method() === "PATCH" && r.ok(),
          { timeout: 90_000 },
        ),
        page.getByTestId("storyboard-scene-description").blur(),
      ]);

      await expect
        .poll(async () => (await getStoryboardScene(page, projectId, sceneId!))?.description ?? "", {
          timeout: 30_000,
        })
        .toContain(`Board desc ${vp.name}`);

      await page.getByTestId("storyboard-view-grid").click();
      const scenes = script.payload!.scenes!;
      if (scenes.length >= 2) {
        const firstCard = page.getByTestId(`storyboard-scene-${scenes[0]!.id}`);
        await firstCard.getByRole("button", { name: "↓" }).click();
        await page.waitForTimeout(800);
      }

      await page.getByTestId("storyboard-view-detail").click();
      await page.getByTestId("storyboard-first-frame").getByRole("button", { name: "Назначить" }).click();
      await uploadImageViaPicker(page);
      await expect
        .poll(async () => (await getStoryboardScene(page, projectId, sceneId!))?.firstFrameAssetId ?? "", {
          timeout: 90_000,
        })
        .not.toBe("");

      await page.getByTestId("storyboard-last-frame").getByRole("button", { name: "Назначить" }).click();
      await uploadImageViaPicker(page);
      await expect
        .poll(async () => (await getStoryboardScene(page, projectId, sceneId!))?.lastFrameAssetId ?? "", {
          timeout: 90_000,
        })
        .not.toBe("");

      const after = await getStoryboardScene(page, projectId, sceneId!);

      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "storyboard");
      await page.getByTestId("storyboard-view-detail").click();
      await expect
        .poll(async () => (await getStoryboardScene(page, projectId, sceneId!))?.firstFrameAssetId ?? "", {
          timeout: 20_000,
        })
        .toBe(after?.firstFrameAssetId);
      await expect
        .poll(async () => (await getStoryboardScene(page, projectId, sceneId!))?.description ?? "", { timeout: 20_000 })
        .toContain(`Board desc ${vp.name}`);
      await acceptanceScreenshot(page, `phase5-storyboard-detail-${vp.name}.png`);
    });
  }

  test("Storyboard revision conflict returns 409", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectId = await openRealNewProject(page);
    await gotoStudioSection(page, projectId, "script");
    await addScriptScenesViaUI(page, 1, projectId);
    const script = (await (await page.request.get(`/api/v1/projects/${projectId}/script`)).json()) as {
      payload?: { scenes?: Array<{ id: string }> };
    };
    const sceneId = script.payload!.scenes![0]!.id;
    await page.request.post(`/api/v1/projects/${projectId}/storyboard/sync`, { data: {} });
    const scene = await getStoryboardScene(page, projectId, sceneId);
    expect(scene?.revision).toBeTruthy();
    const stale = await page.request.patch(`/api/v1/projects/${projectId}/storyboard/scenes/${sceneId}`, {
      data: { description: "stale", expectedRevision: (scene!.revision ?? 1) - 1 },
    });
    expect(stale.status()).toBe(409);
  });
});
