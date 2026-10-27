import { expect, type Page } from "@playwright/test";
import {
  fetchAgentRuns,
  isAgentInProductionPipeline,
  latestAgentRun,
} from "./agent-waits";
import { resyncRealThreadFromApi, scrollRealThreadToBottom } from "./real-ui-sync";

type ApprovalRow = {
  id: string;
  status: string;
  targetType: string;
  targetVersion: string;
};

async function listApprovals(page: Page, projectId: string): Promise<ApprovalRow[]> {
  const res = await page.request.get(`/api/v1/projects/${projectId}/approvals`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { items?: ApprovalRow[] };
  return body.items ?? [];
}

function pendingCount(items: ApprovalRow[]) {
  return items.filter((a) => a.status === "PENDING").length;
}

function approvedCount(items: ApprovalRow[]) {
  return items.filter((a) => a.status === "APPROVED").length;
}

/** Waits for PENDING gate (API read-only); approves exactly one gate via visible UI click. */
export async function approveNextPendingViaUi(page: Page, projectId: string, timeoutMs = 180_000) {
  await expect
    .poll(async () => pendingCount(await listApprovals(page, projectId)), {
      timeout: timeoutMs,
      intervals: [500, 1000, 2000, 3000],
    })
    .toBeGreaterThan(0);

  await resyncRealThreadFromApi(page, projectId);
  await scrollRealThreadToBottom(page);

  const card = page.locator('[data-testid="approval-card"][data-approval-status="pending"]').last();
  await expect(card).toBeVisible({ timeout: 60_000 });

  const approveBtn = card.getByTestId("approval-action-approve").or(card.getByRole("button", { name: /Утверд/i }));
  await expect(approveBtn.first()).toBeEnabled({ timeout: 30_000 });

  const approvedBefore = approvedCount(await listApprovals(page, projectId));
  await approveBtn.first().click();

  await expect
    .poll(async () => approvedCount(await listApprovals(page, projectId)), {
      timeout: timeoutMs,
      intervals: [500, 1000, 2000, 3000],
    })
    .toBeGreaterThan(approvedBefore);

  await expect(card).not.toHaveAttribute("data-approval-status", "pending", { timeout: 60_000 }).catch(() => {});
}

/** Sequential UI approvals until no PENDING gates remain. */
export async function approveAllPendingViaUi(page: Page, projectId: string, maxRounds = 24) {
  for (let i = 0; i < maxRounds; i++) {
    const pending = pendingCount(await listApprovals(page, projectId));
    if (pending === 0) return;
    await approveNextPendingViaUi(page, projectId);
    await page.waitForTimeout(800);
  }
  await expect.poll(async () => pendingCount(await listApprovals(page, projectId)), { timeout: 60_000 }).toBe(0);
}

/** UI clicks until latest agent run enters mock production (handles lagging PENDING rows after creative tabs). */
export async function ensureAgentReadyForProductionViaUi(page: Page, projectId: string, timeoutMs = 480_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = latestAgentRun(await fetchAgentRuns(page, projectId));
    if (isAgentInProductionPipeline(run)) return;

    const state = run?.productionState ?? "";
    if (state.startsWith("WAITING_")) {
      const pending = pendingCount(await listApprovals(page, projectId));
      if (pending > 0) {
        await approveNextPendingViaUi(page, projectId);
        continue;
      }
      await resyncRealThreadFromApi(page, projectId);
      await scrollRealThreadToBottom(page);
      await page.waitForTimeout(1500);
      continue;
    }

    await page.waitForTimeout(1500);
  }
  const run = latestAgentRun(await fetchAgentRuns(page, projectId));
  throw new Error(
    `Agent not ready for production after ${timeoutMs}ms (productionState=${run?.productionState ?? "none"})`,
  );
}
