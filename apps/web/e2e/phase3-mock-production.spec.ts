import { test, expect } from "@playwright/test";
import { loginRealUser, openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import {
  waitForAgentRunPersisted,
  waitForMockBriefVisible,
  waitForMockDeliveryVisible,
  waitForProductionEnqueued,
} from "./helpers/agent-waits";
import { approvePendingApprovals } from "./helpers/approvals";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";

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
    await waitForMockBriefVisible(page, projectId);

    await approvePendingApprovals(page, projectId);
    await waitForProductionEnqueued(page, projectId);

    await waitForMockDeliveryVisible(page, projectId);

    await pinRealProjectOnReload(page, projectId, "chat");
    await page.reload({ waitUntil: "domcontentloaded" });
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
    await expect(page.getByText(/Финальный ролик|mock-delivery|Brief \(MOCK\)|Утверждено/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
