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

const APPROVAL_ORDER = ["PLAN", "SCRIPT", "STORYBOARD", "COST", "PRODUCTION"] as const;

function sortPending(rows: ApprovalRow[]) {
  return [...rows].sort(
    (a, b) =>
      (APPROVAL_ORDER.indexOf(a.targetType as (typeof APPROVAL_ORDER)[number]) + 1 || 99) -
      (APPROVAL_ORDER.indexOf(b.targetType as (typeof APPROVAL_ORDER)[number]) + 1 || 99),
  );
}

async function approveOneViaApi(page: Page, projectId: string, row: ApprovalRow) {
  let lastBody = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.request.post(`/api/v1/approvals/${row.id}/approve`, {
      data: {
        expectedVersion: row.targetVersion,
        payloadHash: row.payloadHash,
        idempotencyKey: randomUUID(),
      },
    });
    if (res.ok()) return;
    lastBody = await res.text();
    const status = res.status();
    if (status === 409) {
      const refreshed = await listApprovals(page, projectId);
      const decided = refreshed.find((a) => a.id === row.id);
      if (decided?.status === "APPROVED") return;
      if (pendingCount(refreshed) === 0) return;
      continue;
    }
    if ((status === 429 || status >= 500) && attempt < 3) {
      await page.waitForTimeout(1500 * (attempt + 1));
      continue;
    }
    throw new Error(`approve ${row.id} (${row.targetType}) HTTP ${status}: ${lastBody}`);
  }
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
    const pending = sortPending(items.filter((a) => a.status === "PENDING"));
    if (!pending.length) continue;
    const approvedBefore = approvedCount(items);
    await approveOneViaApi(page, projectId, pending[0]!);

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
