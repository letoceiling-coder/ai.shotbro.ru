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

test.describe("Phase 4 unified agent (REAL, project-scoped)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page, context }) => {
    await applyRealAuthOnce(page, context);
  });

  test("AgentRuntime + orchestrator through mock MP4", async ({ page }) => {
    test.setTimeout(1_200_000);

    const projectId = await openRealNewProject(page);
    await enablePhase4AgentForProject(page, projectId);

    await sendRealComposerMessage(
      page,
      "Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo",
    );
    await waitForAgentRunPersisted(page, projectId);
    await waitForPhase4AgentSignalVisible(page, projectId);

    await approvePendingApprovals(page, projectId);
    await waitForProductionEnqueued(page, projectId);

    await waitForMockDeliveryVisible(page, projectId);

    await pinRealProjectOnReload(page, projectId, "chat");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("creative-section-chat").click();
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
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
      }, { timeout: 60_000 })
      .toBe(true);
    await expect(
      page.getByText(/Финальный ролик|mock-delivery|Brief \(MOCK\)|MOCK · Phase 4/i).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
