import { mkdirSync } from "node:fs";
import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import {
  addScriptScenesViaUI,
  getStoryboardScene,
  gotoStudioSection,
  saveScriptSceneFields,
  uploadImageViaPicker,
} from "./helpers/phase5-creative-ui";

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5 combined creative flow", () => {
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

  test("Script → Storyboard → Character → Reference → Models → F5", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectId = await openRealNewProject(page);

    await gotoStudioSection(page, projectId, "script");
    await addScriptScenesViaUI(page, 1);
    await saveScriptSceneFields(page, { title: "Flow scene", durationSeconds: 4, description: "Flow script" });
    const script = (await (await page.request.get(`/api/v1/projects/${projectId}/script`)).json()) as {
      payload?: { scenes?: Array<{ id: string }> };
    };
    const sceneId = script.payload!.scenes![0]!.id;

    await gotoStudioSection(page, projectId, "storyboard");
    await expect(page.getByTestId("storyboard-scene-grid")).toBeVisible({ timeout: 25_000 });
    await page.getByTestId("storyboard-view-detail").click();
    await page.getByTestId("storyboard-first-frame").getByRole("button", { name: "Назначить" }).click();
    await uploadImageViaPicker(page);

    await gotoStudioSection(page, projectId, "characters");
    await page.getByTestId("character-create").click();
    await page.getByTestId("character-name").fill("Flow Character");
    await page.getByTestId("character-save").click();
    await page.getByTestId("character-assign-submit").click();

    await gotoStudioSection(page, projectId, "references");
    await page.getByTestId("reference-role").click();
    await page.getByRole("option", { name: "STYLE" }).click();
    await page.getByTestId("reference-attach-open").click();
    await uploadImageViaPicker(page);

    await gotoStudioSection(page, projectId, "models");
    await expect(page.getByTestId("model-settings-section").or(page.getByTestId("creative-section-nav"))).toBeVisible({
      timeout: 20_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await gotoStudioSection(page, projectId, "storyboard");
    await page.getByTestId("storyboard-view-detail").click();
    const scene = await getStoryboardScene(page, projectId, sceneId);
    expect(scene?.firstFrameAssetId).toBeTruthy();

    await gotoStudioSection(page, projectId, "references");
    await expect(page.getByTestId("reference-list")).toContainText("STYLE");

    await page.screenshot({ path: "test-results/phase5-creative-flow-final.png", fullPage: true });
  });
});
