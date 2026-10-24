import { expect, type Page } from "@playwright/test";

type ApprovalRow = { id: string; status: string; targetType: string };

async function listApprovals(page: Page, projectId: string): Promise<ApprovalRow[]> {
  const res = await page.request.get(`/api/v1/projects/${projectId}/approvals`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { items?: ApprovalRow[] };
  return body.items ?? [];
}

function approvedCount(items: ApprovalRow[]) {
  return items.filter((a) => a.status === "APPROVED").length;
}

function pendingCount(items: ApprovalRow[]) {
  return items.filter((a) => a.status === "PENDING").length;
}

/**
 * Clicks «Утвердить» in UI until API reports zero PENDING approvals.
 * Waits for APPROVED count to increase after each click (SCRIPT may appear while PLAN is decided).
 */
export async function approvePendingApprovals(page: Page, projectId: string, maxRounds = 12) {
  for (let round = 0; round < maxRounds; round++) {
    let items = await listApprovals(page, projectId);
    if (pendingCount(items) === 0) return;

    const approvedBefore = approvedCount(items);

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
      .poll(async () => approvedCount(await listApprovals(page, projectId)), {
        timeout: 180_000,
        intervals: [500, 1000, 2000, 3000],
      })
      .toBeGreaterThan(approvedBefore);

    await expect
      .poll(async () => page.getByRole("button", { name: /^Утвердить$/, disabled: false }).count(), {
        timeout: 60_000,
        intervals: [300, 500, 1000, 2000],
      })
      .toBeGreaterThanOrEqual(0);
  }

  await expect.poll(async () => pendingCount(await listApprovals(page, projectId)), { timeout: 30_000 }).toBe(0);
}
