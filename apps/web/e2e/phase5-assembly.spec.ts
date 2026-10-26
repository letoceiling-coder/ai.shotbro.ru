import { test, expect } from "@playwright/test";
import { applyRealAuthOnce } from "./helpers/real-auth-once";
import { openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import { enablePhase4AgentForProject } from "./helpers/phase4-rollout";
import {
  waitForAgentRunPersisted,
  waitForMockDeliveryVisible,
  waitForPhase4AgentSignalVisible,
  waitForProductionEnqueued,
} from "./helpers/agent-waits";
import { approvePendingApprovals } from "./helpers/approvals";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { gotoStudioSection } from "./helpers/phase5-creative-ui";
import { seedScriptScene } from "./helpers/phase5-creative-seed";

test.describe("Phase 5I timeline-driven assembly", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page, context }) => {
    await applyRealAuthOnce(page, context);
  });

  test("Timeline edits then mock MP4 assembly", async ({ page }) => {
    test.setTimeout(1_200_000);

    const projectId = await openRealNewProject(page);
    await seedScriptScene(page, projectId);

    await gotoStudioSection(page, projectId, "storyboard");
    await page.getByTestId("storyboard-sync").click();
    await expect
      .poll(async () => (await page.request.get(`/api/v1/projects/${projectId}/storyboard`)).ok(), {
        timeout: 30_000,
      })
      .toBe(true);

    await gotoStudioSection(page, projectId, "timeline");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/timeline/sync-from-storyboard") && r.ok(), { timeout: 60_000 }),
      page.getByTestId("timeline-sync-storyboard").click(),
    ]);

    const prep = await page.request.post(`/api/v1/projects/${projectId}/timeline/prepare-assembly`);
    expect(prep.ok()).toBeTruthy();
    const prepJson = (await prep.json()) as { snapshot?: { timelineVersion?: number } };
    expect(prepJson.snapshot?.timelineVersion).toBeGreaterThan(0);

    await enablePhase4AgentForProject(page, projectId);
    await page.getByTestId("creative-section-chat").click();
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
    await sendRealComposerMessage(
      page,
      "Собери финальный ролик по текущему timeline, mock без live провайдеров",
    );
    await waitForAgentRunPersisted(page, projectId);
    await waitForPhase4AgentSignalVisible(page, projectId);
    await approvePendingApprovals(page, projectId);
    await waitForProductionEnqueued(page, projectId);
    await waitForMockDeliveryVisible(page, projectId);

    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/assets`);
        if (!res.ok()) return false;
        const assets = (await res.json()) as Array<{ mimeType?: string; originalName?: string }> | { items?: unknown[] };
        const list = Array.isArray(assets) ? assets : (assets.items ?? []);
        return list.some(
          (a) =>
            typeof a === "object" &&
            a !== null &&
            (a as { mimeType?: string }).mimeType === "video/mp4" &&
            String((a as { originalName?: string }).originalName ?? "").includes("mock-delivery"),
        );
      }, { timeout: 120_000 })
      .toBe(true);

    await pinRealProjectOnReload(page, projectId, "chat");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("creative-section-chat").click();
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
  });
});
