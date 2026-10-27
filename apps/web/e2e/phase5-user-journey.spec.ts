import { test, expect, type BrowserContext } from "@playwright/test";
import { applyRealAuthOnce } from "./helpers/real-auth-once";
import { openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import {
  waitForAgentRunPersisted,
  waitForMockBriefVisible,
  waitForMockDeliveryVisible,
  waitForProductionEnqueued,
  waitForMockMp4Asset,
} from "./helpers/agent-waits";
import { approveAllPendingViaUi, approveNextPendingViaUi } from "./helpers/ui-approvals";
import { gotoStudioSection } from "./helpers/phase5-creative-ui";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { waitForAssistantBlockInApi } from "./helpers/real-ui-sync";
import {
  attachReferenceViaUi,
  reorderTimelineClipViaUi,
  syncTimelineFromStoryboardViaUi,
} from "./helpers/user-journey-ui";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

test.describe("Phase 5 full REAL user journey", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Requires E2E_REAL_BACKEND=1 on staging");
  test.describe.configure({ mode: "serial" });

  let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await applyRealAuthOnce(page, context);
    loggedInStorage = await context.storageState();
    await context.close();
  });

  test.beforeEach(async ({ context, page }) => {
    if (loggedInStorage?.cookies.length) await context.addCookies(loggedInStorage.cookies);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.setItem("shotbro-studio-mode-v1", "REAL"));
  });

  test("desktop1920 — full UI-only production path", async ({ page }) => {
    test.setTimeout(1_800_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    const projectId = await openRealNewProject(page);

    await sendRealComposerMessage(
      page,
      "Создай рекламный ролик 15 секунд 9:16 для TestCo: три сцены, mock без live AI",
    );
    await waitForAgentRunPersisted(page, projectId);
    await waitForMockBriefVisible(page, projectId);

    await approveNextPendingViaUi(page, projectId);
    await waitForAssistantBlockInApi(
      page,
      projectId,
      (blocks) => blocks.some((b) => b.type === "script" || b.type === "approval"),
      240_000,
    );

    await gotoStudioSection(page, projectId, "script");
    await expect(page.getByTestId("script-editor").or(page.getByTestId("workspace-state"))).toBeVisible({
      timeout: 60_000,
    });

    await gotoStudioSection(page, projectId, "chat");
    await approveNextPendingViaUi(page, projectId);

    await gotoStudioSection(page, projectId, "storyboard");
    await expect(page.getByTestId("storyboard-studio").or(page.getByTestId("workspace-state"))).toBeVisible({
      timeout: 60_000,
    });
    if (await page.getByTestId("storyboard-sync").isVisible().catch(() => false)) {
      await page.getByTestId("storyboard-sync").click();
    }

    await gotoStudioSection(page, projectId, "chat");
    await approveNextPendingViaUi(page, projectId);

    await gotoStudioSection(page, projectId, "characters");
    await expect(page.getByTestId("character-studio")).toBeVisible({ timeout: 30_000 });
    if (await page.getByTestId("character-create").isVisible().catch(() => false)) {
      await page.getByTestId("character-create").click();
      await page.getByTestId("character-name").fill("Hero journey");
      await page.getByTestId("character-save").click();
    }

    await gotoStudioSection(page, projectId, "references");
    await expect(page.getByTestId("reference-manager")).toBeVisible({ timeout: 30_000 });
    await attachReferenceViaUi(page, "FIRST_FRAME");
    await page.reload({ waitUntil: "domcontentloaded" });
    await gotoStudioSection(page, projectId, "references");
    await expect(page.getByTestId("reference-list")).toContainText("FIRST_FRAME");

    await gotoStudioSection(page, projectId, "prompts");
    await expect(page.getByTestId("prompt-studio").or(page.getByTestId("workspace-state"))).toBeVisible({
      timeout: 30_000,
    });

    await gotoStudioSection(page, projectId, "models");
    await expect(page.getByTestId("model-settings-section")).toBeVisible({ timeout: 30_000 });

    await gotoStudioSection(page, projectId, "timeline");
    await expect(page.getByTestId("timeline-studio")).toBeVisible({ timeout: 60_000 });
    await syncTimelineFromStoryboardViaUi(page, projectId);
    await reorderTimelineClipViaUi(page, projectId);
    if (await page.getByTestId("timeline-save").isEnabled().catch(() => false)) {
      await page.getByTestId("timeline-save").click();
    }

    await gotoStudioSection(page, projectId, "assets");
    await expect(page.getByTestId("project-assets")).toBeVisible({ timeout: 30_000 });

    await gotoStudioSection(page, projectId, "chat");
    await approveAllPendingViaUi(page, projectId);
    await waitForProductionEnqueued(page, projectId);
    await waitForMockDeliveryVisible(page, projectId);
    await waitForMockMp4Asset(page, projectId);

    await gotoStudioSection(page, projectId, "production");
    await expect(page.getByTestId("production-section")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/COMPLETED|Enqueued|PRODUCING|QUEUED/i).first()).toBeVisible();

    await pinRealProjectOnReload(page, projectId, "production");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("production-section")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/assets`);
        if (!res.ok()) return false;
        const list = (await res.json()) as Array<{ mimeType?: string; originalName?: string; status?: string }>;
        return list.some(
          (a) =>
            a.mimeType === "video/mp4" &&
            String(a.originalName ?? "").includes("mock-delivery") &&
            a.status === "READY",
        );
      }, { timeout: 60_000 })
      .toBe(true);

    const tl = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
    expect(tl.ok()).toBeTruthy();
    const tlBody = (await tl.json()) as { payload?: { revision?: number } };
    expect((tlBody.payload?.revision ?? 0) >= 1).toBeTruthy();
  });

  for (const vp of viewports.filter((v) => v.name !== "desktop1920")) {
    test(`viewport smoke — REAL nav @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const projectId = await openRealNewProject(page);
      await expect(page.getByTestId("creative-workspace")).toBeVisible({ timeout: 120_000 });
      for (const id of ["chat", "script", "storyboard", "characters", "references", "prompts", "models", "timeline", "production", "assets"]) {
        await page.getByTestId(`creative-section-${id}`).click();
        await expect(page.getByTestId(`creative-section-${id}`)).toBeVisible();
      }
      await pinRealProjectOnReload(page, projectId, "chat");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
    });
  }
});
