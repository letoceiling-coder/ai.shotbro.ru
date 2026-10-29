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
import {
  waitForAgentRunPersisted,
  waitForMockDeliveryVisible,
  waitForProductionEnqueued,
} from "./helpers/agent-waits";
import { approvePendingApprovals } from "./helpers/approvals";

const demoMp4 = () =>
  readFileSync(join(process.cwd(), "public", "demo-assets", "shotbro-demo.mp4"));

test.describe("Phase 5L-B unified studio coherence", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page, context }) => {
    await applyRealAuthOnce(page, context);
  });

  test("desktop — agent storyboard mutation sync + auto-nav", async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    const projectId = await openRealNewProject(page);
    await gotoStudioSection(page, projectId, "script");
    await addScriptScenesViaUI(page, 2, projectId);
    await gotoStudioSection(page, projectId, "assets");
    await uploadViaLibraryFilePicker(page, {
      name: "5lb.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    await expect(page.getByTestId(/asset-card-/).first()).toBeVisible({ timeout: 120_000 });

    await gotoStudioSection(page, projectId, "chat");
    await sendRealComposerMessage(
      page,
      "phase5k: найди фото в библиотеке и установи первым кадром второй сцены",
    );

    await waitForAssistantBlockInApi(page, projectId, (blocks) =>
      blocks.some(
        (b) =>
          b.type === "agent_tool_result" &&
          (b as { toolName?: string; success?: boolean }).toolName === "set_scene_first_frame_by_ordinal" &&
          (b as { success?: boolean }).success === true,
      ),
    );

    const storyboardTab = page.getByTestId("creative-section-storyboard");
    await expect
      .poll(
        async () => {
          if ((await storyboardTab.getAttribute("data-active")) === "true") return true;
          const input = page.getByTestId("real-composer-input");
          if (await input.isVisible().catch(() => false)) await input.blur();
          else await page.getByTestId("creative-section-brief").click();
          return (await storyboardTab.getAttribute("data-active")) === "true";
        },
        { timeout: 120_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);
    await expect(page.getByTestId("storyboard-studio")).toBeVisible({ timeout: 60_000 });

    const storyboard = await page.request.get(`/api/v1/projects/${projectId}/storyboard`);
    expect(storyboard.ok()).toBeTruthy();
    const sb = (await storyboard.json()) as { payload?: { scenes?: Array<{ firstFrameAssetId?: string }> } };
    const scenes = sb.payload?.scenes ?? [];
    expect(scenes.some((s) => Boolean(s.firstFrameAssetId))).toBe(true);
  });

  test("desktop — auto-nav can be disabled", async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      const raw = localStorage.getItem("shotbro-studio-demo-v1");
      const base = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      base.state = { ...base.state, creativeAutoNavigate: false, creativeSection: "chat" };
      localStorage.setItem("shotbro-studio-demo-v1", JSON.stringify(base));
    });

    const projectId = await openRealNewProject(page);
    await gotoStudioSection(page, projectId, "script");
    await addScriptScenesViaUI(page, 1, projectId);
    await gotoStudioSection(page, projectId, "assets");
    await uploadViaLibraryFilePicker(page, {
      name: "5lb-off.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    await expect(page.getByTestId(/asset-card-/).first()).toBeVisible({ timeout: 120_000 });
    await gotoStudioSection(page, projectId, "chat");
    await sendRealComposerMessage(page, "phase5k найди фото и первым кадром второй сцены");
    await expect(page.getByTestId("agent-tool-result-search_project_assets").first()).toBeVisible({
      timeout: 120_000,
    });
    await page.waitForTimeout(3000);
    await expect(page.getByTestId("creative-section-chat")).toHaveAttribute("data-active", "true");
  });

  test("desktop — mock delivery video_result + production player", async ({ page }) => {
    test.setTimeout(1_200_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    const projectId = await openRealNewProject(page);
    await sendRealComposerMessage(
      page,
      "Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo",
    );
    await waitForAgentRunPersisted(page, projectId);
    await approvePendingApprovals(page, projectId);
    await waitForProductionEnqueued(page, projectId);
    await waitForMockDeliveryVisible(page, projectId);

    const conv = await page.request.get(`/api/v1/projects/${projectId}/conversations`);
    expect(conv.ok()).toBeTruthy();
    const convBody = (await conv.json()) as Array<{ id: string }> | { items?: Array<{ id: string }> };
    const conversationId = Array.isArray(convBody) ? convBody[0]?.id : convBody.items?.[0]?.id;
    expect(conversationId).toBeTruthy();

    const msgs = await page.request.get(`/api/v1/conversations/${conversationId}/messages`);
    expect(msgs.ok()).toBeTruthy();
    const pageBody = (await msgs.json()) as { items?: Array<{ blocks?: Array<{ type: string; url?: string; assetId?: string }> }> };
    const videoBlock = pageBody.items
      ?.flatMap((m) => m.blocks ?? [])
      .find((b) => b.type === "video_result");
    expect(videoBlock?.assetId).toBeTruthy();
    expect(String(videoBlock?.url ?? "")).toMatch(/^shotbro-asset:\/\//);

    const dl = await page.request.get(`/api/v1/assets/${videoBlock!.assetId}/preview-url`);
    expect(dl.status()).toBeLessThan(300);
    const dlBody = (await dl.json()) as { url?: string };
    expect(dlBody.url).toMatch(/^https?:\/\//);

    await gotoStudioSection(page, projectId, "production");
    await expect(page.getByTestId("production-delivery-player")).toBeVisible({ timeout: 120_000 });
    await expect(page.locator("video").first()).toHaveAttribute("src", /.+/);

    await pinRealProjectOnReload(page, projectId, "chat");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("video-result-card").first()).toBeVisible({ timeout: 120_000 });
  });
});
