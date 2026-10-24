import { test, expect } from "@playwright/test";
import { loginRealUser, openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import { enablePhase4AgentForProject } from "./helpers/phase4-rollout";
import {
  waitForAgentRunPersisted,
  waitForMockDeliveryVisible,
  waitForPhase4AgentSignalVisible,
} from "./helpers/agent-waits";
import { approvePendingApprovals } from "./helpers/approvals";

test.describe("Phase 4 unified agent (REAL, project-scoped)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loginRealUser(page);
  });

  test("AgentRuntime + orchestrator through mock MP4", async ({ page }) => {
    test.setTimeout(600_000);

    const projectId = await openRealNewProject(page);
    await enablePhase4AgentForProject(page, projectId);

    await sendRealComposerMessage(
      page,
      "Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo",
    );
    await waitForAgentRunPersisted(page, projectId);
    await waitForPhase4AgentSignalVisible(page);

    await approvePendingApprovals(page, 6);

    await waitForMockDeliveryVisible(page);

    await page.reload();
    await expect(page.getByText(/Brief \(MOCK\)|Финальный ролик|Утверждено|MOCK · Phase 4/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
