import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyRealAuthOnce } from "./helpers/real-auth-once";
import { openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import { gotoStudioSection, addScriptScenesViaUI } from "./helpers/phase5-creative-ui";
import { uploadViaLibraryFilePicker } from "./helpers/asset-library-upload";
import { tinyPngBuffer } from "./helpers/phase5-creative-seed";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { waitForAssistantBlockInApi } from "./helpers/real-ui-sync";

const demoMp4 = () =>
  readFileSync(join(process.cwd(), "public", "demo-assets", "shotbro-demo.mp4"));

test.describe("Phase 5K agent integration", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page, context }) => {
    await applyRealAuthOnce(page, context);
  });

  test("desktop1920 — mock NL creative tools (REAL DB)", async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    const projectId = await openRealNewProject(page);

    await gotoStudioSection(page, projectId, "script");
    await addScriptScenesViaUI(page, 2, projectId);

    await gotoStudioSection(page, projectId, "assets");
    await uploadViaLibraryFilePicker(page, {
      name: "phase5k-agent.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    await expect(page.getByTestId(/asset-card-/).first()).toBeVisible({ timeout: 120_000 });

    await uploadViaLibraryFilePicker(page, {
      name: "phase5k-demo.mp4",
      mimeType: "video/mp4",
      buffer: demoMp4(),
    });
    await expect(page.getByTestId(/asset-card-/).filter({ hasText: /mp4/i }).first()).toBeVisible({
      timeout: 180_000,
    });

    await gotoStudioSection(page, projectId, "chat");

    await sendRealComposerMessage(
      page,
      "phase5k: Найди в библиотеке фото, установи первым кадром второй сцены, улучши video prompt, предложи модель и стоимость, привяжи видео к timeline",
    );

    await waitForAssistantBlockInApi(page, projectId, (blocks) =>
      blocks.some(
        (b) =>
          b.type === "agent_tool_result" &&
          (b as { toolName?: string }).toolName === "set_scene_first_frame_by_ordinal",
      ),
    );

    const storyboard = await page.request.get(`/api/v1/projects/${projectId}/storyboard`);
    expect(storyboard.ok()).toBeTruthy();
    const sb = (await storyboard.json()) as {
      payload?: { scenes?: Array<{ sceneId: string; firstFrameAssetId?: string }> };
      scenes?: Array<{ sceneId: string; firstFrameAssetId?: string }>;
    };
    const scenes = sb.payload?.scenes ?? sb.scenes ?? [];
    expect(scenes.length).toBeGreaterThan(1);
    expect(scenes[1]?.firstFrameAssetId).toBeTruthy();

    const sceneId = scenes[1]!.sceneId;
    const prompts = await page.request.get(`/api/v1/projects/${projectId}/scenes/${sceneId}/prompts/latest`);
    expect(prompts.ok()).toBeTruthy();

    const timeline = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
    expect(timeline.ok()).toBeTruthy();
    const tl = (await timeline.json()) as { payload?: { tracks?: Array<{ clips: Array<{ sceneId?: string; assetId?: string }> }> } };
    const clips = tl.payload?.tracks?.flatMap((t) => t.clips) ?? [];
    const clip = clips.find((c) => c.sceneId === sceneId);
    expect(clip?.assetId).toBeTruthy();

    await pinRealProjectOnReload(page, projectId, "storyboard");
    await page.reload({ waitUntil: "domcontentloaded" });
    const storyboardAfter = await page.request.get(`/api/v1/projects/${projectId}/storyboard`);
    const sb2 = (await storyboardAfter.json()) as typeof sb;
    expect(sb2.payload?.scenes?.[1]?.firstFrameAssetId).toBe(scenes[1]?.firstFrameAssetId);
  });

  test("desktop1440 — agent tool cards visible", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const projectId = await openRealNewProject(page);
    await gotoStudioSection(page, projectId, "script");
    await addScriptScenesViaUI(page, 1, projectId);
    await gotoStudioSection(page, projectId, "assets");
    await uploadViaLibraryFilePicker(page, {
      name: "smoke.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    await expect(page.getByTestId(/asset-card-/).first()).toBeVisible({ timeout: 120_000 });
    await gotoStudioSection(page, projectId, "chat");
    await sendRealComposerMessage(page, "phase5k найди фото в библиотеке и первым кадром второй сцены");
    await expect(page.getByTestId("agent-tool-result-search_project_assets").first()).toBeVisible({
      timeout: 120_000,
    });
  });
});
