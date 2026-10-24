import { expect, type Page } from "@playwright/test";

/** Waits until project has at least one persisted agent run (API truth, not SSE-only). */
export async function waitForAgentRunPersisted(page: Page, projectId: string, timeoutMs = 120_000) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/agent/runs`);
        if (!res.ok()) return 0;
        const body = (await res.json()) as unknown;
        return Array.isArray(body) ? body.length : 0;
      },
      { timeout: timeoutMs, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0);
}

export async function waitForMockBriefVisible(page: Page, timeoutMs = 180_000) {
  const brief = page.getByText(/Brief \(MOCK\)|План производства/i).first();
  await expect(brief).toBeVisible({ timeout: timeoutMs });
  await brief.scrollIntoViewIfNeeded();
  return brief;
}

export async function waitForPhase4AgentSignalVisible(page: Page, timeoutMs = 180_000) {
  const signal = page
    .getByText(/AgentRuntime|MOCK · Phase 4|Brief \(MOCK\)|План производства/i)
    .first();
  await expect(signal).toBeVisible({ timeout: timeoutMs });
  await signal.scrollIntoViewIfNeeded();
  return signal;
}

export async function waitForMockDeliveryVisible(page: Page, timeoutMs = 420_000) {
  const delivery = page
    .getByText(/Финальный ролик|Mock-производство|Production board|Готово: mock|mock-delivery/i)
    .first();
  await expect(delivery).toBeVisible({ timeout: timeoutMs });
  await delivery.scrollIntoViewIfNeeded();
  return delivery;
}
