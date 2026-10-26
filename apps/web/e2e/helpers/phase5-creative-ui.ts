import { expect, type Page } from "@playwright/test";
import { pinRealProjectOnReload } from "./real-studio-state";
import { tinyPngBuffer } from "./phase5-creative-seed";

export type CreativeSection =
  | "chat"
  | "script"
  | "storyboard"
  | "characters"
  | "references"
  | "prompts"
  | "timeline"
  | "models";

export async function gotoStudioSection(page: Page, projectId: string, section: CreativeSection) {
  const pinSection =
    section === "models" ? "models" : section === "chat" ? "chat" : section;
  await pinRealProjectOnReload(page, projectId, pinSection);
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await page.getByTestId(`creative-section-${section}`).click();
}

export async function addScriptScenesViaUI(page: Page, count: number, projectId?: string) {
  await expect(page.getByTestId("script-editor").or(page.getByTestId("workspace-state"))).toBeVisible({
    timeout: 20_000,
  });
  if (!(await page.getByTestId("script-add-scene").isVisible().catch(() => false)) && projectId) {
    const boot = await page.request.post(`/api/v1/projects/${projectId}/scripts/scenes`, {
      data: { title: "Bootstrap scene" },
    });
    expect(boot.ok()).toBeTruthy();
    await page.reload({ waitUntil: "domcontentloaded" });
    await pinRealProjectOnReload(page, projectId, "script");
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await page.getByTestId("creative-section-script").click();
    await expect(page.getByTestId("script-add-scene")).toBeVisible({ timeout: 20_000 });
  }
  for (let i = 0; i < count; i++) {
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/scripts/scenes") && r.request().method() === "POST" && r.ok(),
        { timeout: 90_000 },
      ),
      page.getByTestId("script-add-scene").click(),
    ]);
  }
}

export async function saveScriptSceneFields(
  page: Page,
  fields: { title?: string; durationSeconds?: number; description?: string },
) {
  if (fields.title != null) await page.locator("#scene-title").fill(fields.title);
  if (fields.durationSeconds != null) await page.locator("#scene-duration").fill(String(fields.durationSeconds));
  if (fields.description != null) await page.locator("#scene-desc").fill(fields.description);
  const saveBtn = page.getByTestId("script-save-scene");
  await expect(saveBtn).toBeVisible({ timeout: 15_000 });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/scripts/scenes/") && r.request().method() === "PATCH" && r.ok(),
      { timeout: 90_000 },
    ),
    saveBtn.click(),
  ]);
}

export async function uploadImageViaPicker(page: Page) {
  await expect(page.getByTestId("asset-picker-dialog")).toBeVisible();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: "e2e-ui.png",
    mimeType: "image/png",
    buffer: tinyPngBuffer(),
  });
  await expect(page.getByTestId("asset-picker-dialog")).toBeHidden({ timeout: 90_000 });
}

export async function getStoryboardScene(page: Page, projectId: string, sceneId: string) {
  const r = await page.request.get(`/api/v1/projects/${projectId}/storyboard`);
  expect(r.ok()).toBeTruthy();
  const j = (await r.json()) as {
    payload?: { scenes?: Array<{ sceneId: string; revision: number; description?: string; durationSeconds?: number; firstFrameAssetId?: string; lastFrameAssetId?: string }> };
  };
  return j.payload?.scenes?.find((s) => s.sceneId === sceneId);
}
