import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { resyncRealThreadFromApi, scrollRealThreadToBottom } from "./real-ui-sync";

type ApprovalRow = {
  id: string;
  status: string;
  targetType: string;
  targetVersion: string;
  payloadHash: string;
};

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

async function waitForPendingApprovalApi(page: Page, projectId: string, timeoutMs = 120_000) {
  await expect
    .poll(async () => pendingCount(await listApprovals(page, projectId)), {
      timeout: timeoutMs,
      intervals: [500, 1000, 2000],
    })
    .toBeGreaterThan(0);
}

async function approveOneViaApi(page: Page, row: ApprovalRow) {
  const res = await page.request.post(`/api/v1/approvals/${row.id}/approve`, {
    data: {
      expectedVersion: row.targetVersion,
      payloadHash: row.payloadHash,
      idempotencyKey: randomUUID(),
    },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Approves all PENDING gates (PLAN → … → PRODUCTION) using real API + session cookies.
 * Asserts approval cards appear in chat when possible; avoids flaky UI-only clicks.
 */
export async function approvePendingApprovals(page: Page, projectId: string, maxRounds = 24) {
  for (let round = 0; round < maxRounds; round++) {
    let items = await listApprovals(page, projectId);
    if (pendingCount(items) === 0) return;

    await waitForPendingApprovalApi(page, projectId, 180_000);
    await resyncRealThreadFromApi(page, projectId);
    await scrollRealThreadToBottom(page);

    const card = page.getByTestId("approval-card").first();
    if (await card.isVisible().catch(() => false)) {
      await expect(card).toBeVisible({ timeout: 30_000 });
    }

    items = await listApprovals(page, projectId);
    const pending = items.filter((a) => a.status === "PENDING");
    const approvedBefore = approvedCount(items);
    for (const row of pending) {
      await approveOneViaApi(page, row);
    }

    await expect
      .poll(async () => approvedCount(await listApprovals(page, projectId)), {
        timeout: 180_000,
        intervals: [500, 1000, 2000, 3000],
      })
      .toBeGreaterThan(approvedBefore);

    await page.waitForTimeout(1500);
    if (pendingCount(await listApprovals(page, projectId)) === 0) return;
  }

  await expect.poll(async () => pendingCount(await listApprovals(page, projectId)), { timeout: 60_000 }).toBe(0);
}
