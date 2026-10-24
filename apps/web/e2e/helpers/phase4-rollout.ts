import type { Page } from "@playwright/test";

/** Enable project-scoped AgentRuntime via authorized admin API (not a public execution toggle). */
export async function enablePhase4AgentForProject(page: Page, projectId: string) {
  const res = await page.request.post(`/api/v1/projects/${projectId}/agent/runtime-rollout`, {
    data: { enable: true, reason: "e2e-phase4-unified" },
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`runtime-rollout failed ${res.status()}: ${text.slice(0, 200)}`);
  }
}
