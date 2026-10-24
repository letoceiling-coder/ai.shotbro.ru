import { expect, type Page } from "@playwright/test";

type ApprovalRow = { id: string; status: string; targetType: string };

async function listApprovals(page: Page, projectId: string): Promise<ApprovalRow[]> {
  const res = await page.request.get(`/api/v1/projects/${projectId}/approvals`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { items?: ApprovalRow[] };
  return body.items ?? [];
}

async function pendingCount(page: Page, projectId: string) {
  const items = await listApprovals(page, projectId);
  return items.filter((a) => a.status === "PENDING").length;
}

/**
 * Clicks «Утвердить» in UI until API reports zero PENDING approvals.
 * Uses API only as completion signal — each decision still goes through the approval card.
 */
export async function approvePendingApprovals(page: Page, projectId: string, maxRounds = 12) {
  for (let round = 0; round < maxRounds; round++) {
    const pending = await pendingCount(page, projectId);
    if (pending === 0) return;

    const btn = page.getByRole("button", { name: /^Утвердить$/, disabled: false }).first();
    await expect(btn).toBeVisible({ timeout: 90_000 });
    await btn.click();
    await page
      .waitForResponse(
        (r) => /\/api\/v1\/approvals\/[^/]+\/approve/.test(r.url()) && r.request().method() === "POST" && r.ok(),
        { timeout: 90_000 },
      )
      .catch(() => undefined);

    await expect
      .poll(async () => pendingCount(page, projectId), {
        timeout: 180_000,
        intervals: [500, 1000, 2000, 3000],
      })
      .toBeLessThan(pending);

    await expect
      .poll(async () => page.getByRole("button", { name: /^Утвердить$/, disabled: false }).count(), {
        timeout: 30_000,
        intervals: [300, 500, 1000],
      })
      .toBeGreaterThanOrEqual(0);
  }

  await expect.poll(async () => pendingCount(page, projectId), { timeout: 30_000 }).toBe(0);
}
