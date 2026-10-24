import { test, expect } from "@playwright/test";
import { loginRealUser, openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import {
  waitForAgentRunPersisted,
  waitForMockBriefVisible,
  waitForMockDeliveryVisible,
} from "./helpers/agent-waits";
import { approvePendingApprovals } from "./helpers/approvals";

test.describe("Phase 3 mock production (REAL)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loginRealUser(page);
  });

  test("full chain through delivery MP4", async ({ page }) => {
    test.setTimeout(1_200_000);

    const projectId = await openRealNewProject(page);
    await sendRealComposerMessage(
      page,
      "Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo",
    );
    await waitForAgentRunPersisted(page, projectId);
    await waitForMockBriefVisible(page);

    await approvePendingApprovals(page, 6);

    await waitForMockDeliveryVisible(page, projectId);

    await page.reload();
    await expect(page.getByText(/Brief \(MOCK\)|Финальный ролик|Утверждено/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
