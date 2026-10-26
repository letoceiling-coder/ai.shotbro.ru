import { expect, type Page } from "@playwright/test";
import {
  resyncRealThreadFromApi,
  scrollRealThreadToBottom,
  waitForAssistantBlockInApi,
} from "./real-ui-sync";

/** Waits until project has at least one persisted agent run (API truth, not SSE-only). */
export async function waitForAgentRunPersisted(page: Page, projectId: string, timeoutMs = 120_000) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/agent/runs`);
        if (!res.ok()) return 0;
        const body = (await res.json()) as { items?: unknown[] } | unknown[];
        if (Array.isArray(body)) return body.length;
        return Array.isArray(body.items) ? body.items.length : 0;
      },
      { timeout: timeoutMs, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0);
}

export async function waitForMockBriefVisible(page: Page, projectId: string, timeoutMs = 180_000) {
  await waitForAssistantBlockInApi(
    page,
    projectId,
    (blocks) =>
      blocks.some((b) => b.type === "generation_plan") ||
      blocks.some((b) => b.type === "text" && /Brief|MOCK|План производства/i.test(String(b.markdown ?? b.title ?? ""))),
    timeoutMs,
  );

  await resyncRealThreadFromApi(page, projectId);

  const plan = page.getByTestId("generation-plan-card").first();
  await expect(plan).toBeVisible({ timeout: 60_000 });
  await plan.scrollIntoViewIfNeeded();
  return plan;
}

export async function waitForPhase4AgentSignalVisible(page: Page, projectId: string, timeoutMs = 180_000) {
  await waitForAssistantBlockInApi(
    page,
    projectId,
    (blocks) =>
      blocks.some(
        (b) =>
          b.type === "generation_plan" ||
          b.type === "tool_execution" ||
          (b.type === "text" && /AgentRuntime|MOCK · Phase 4|Brief \(MOCK\)|План производства/i.test(String(b.markdown ?? ""))),
      ),
    timeoutMs,
  );

  await resyncRealThreadFromApi(page, projectId);

  const signal = page.getByTestId("generation-plan-card").first();
  await expect(signal).toBeVisible({ timeout: 60_000 });
  await signal.scrollIntoViewIfNeeded();
  return signal;
}

function runItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)) {
    return (body as { items: unknown[] }).items;
  }
  return [];
}

/** After all approvals, orchestrator should enqueue mock production (metadata flag or state). */
export async function waitForProductionEnqueued(page: Page, projectId: string, timeoutMs = 180_000) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/agent/runs`);
        if (!res.ok()) return "";
        const body = (await res.json()) as {
          items?: Array<{ productionState?: string; metadata?: { productionEnqueued?: boolean } }>;
        };
        const run = body.items?.[0];
        if (!run) return "";
        if (run.metadata?.productionEnqueued) return "enqueued";
        const st = run.productionState ?? "";
        if (["QUEUED", "PRODUCING", "COMPLETED"].includes(st)) return st;
        return st;
      },
      { timeout: timeoutMs, intervals: [1000, 2000, 3000] },
    )
    .not.toBe("");
}

/** Waits until mock production graph finished (delivery asset should exist). */
export async function waitForProductionCompleted(page: Page, projectId: string, timeoutMs = 600_000) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/agent/runs`);
        if (!res.ok()) return "";
        const body = (await res.json()) as { items?: Array<{ productionState?: string; status?: string }> };
        const run = body.items?.[0];
        if (!run) return "";
        if (run.productionState === "COMPLETED" || run.status === "COMPLETED") return "done";
        return run.productionState ?? run.status ?? "";
      },
      { timeout: timeoutMs, intervals: [2000, 3000, 5000] },
    )
    .toBe("done");
}

export async function waitForMockMp4Asset(page: Page, projectId: string, timeoutMs = 600_000) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/assets`);
        if (!res.ok()) return false;
        const assets = runItems(await res.json());
        return assets.some(
          (a) =>
            typeof a === "object" &&
            a !== null &&
            (a as { mimeType?: string; originalName?: string }).mimeType === "video/mp4" &&
            String((a as { originalName?: string }).originalName ?? "").includes("mock-delivery"),
        );
      },
      { timeout: timeoutMs, intervals: [1000, 2000, 5000] },
    )
    .toBe(true);
}

export async function waitForMockDeliveryVisible(page: Page, projectId: string, timeoutMs = 600_000) {
  await waitForProductionCompleted(page, projectId, timeoutMs);
  await waitForMockMp4Asset(page, projectId, 120_000);
  await resyncRealThreadFromApi(page, projectId);
  const delivery = page
    .getByText(/Финальный ролик|Mock-производство|Production board|Готово: mock|mock-delivery/i)
    .first();
  await expect(delivery).toBeVisible({ timeout: 90_000 });
  await delivery.scrollIntoViewIfNeeded();
  return delivery;
}
