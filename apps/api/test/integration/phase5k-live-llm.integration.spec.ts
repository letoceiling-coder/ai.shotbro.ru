import { describe, expect, it } from "vitest";
import {
  apiJson,
  expectOk2xx,
  integrationCredentials,
  requireIntegrationEnv,
  signInIntegrationUser,
} from "./http-helpers";

const LIVE = process.env.PHASE5K_LIVE_LLM_SMOKE === "1";

describe.skipIf(!LIVE)("Phase 5K live OpenRouter smoke (minimal spend)", () => {
  it("Russian NL → OpenRouter tool_calls → search_project_assets", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    const { status: createStatus, json: created } = await apiJson<{ id: string; conversationId?: string }>(
      "/api/v1/projects",
      session,
      { method: "POST", body: JSON.stringify({ title: `phase5k-live-${Date.now()}`, settings: {} }) },
    );
    expectOk2xx(createStatus);
    const projectId = created.id;
    const { status: convStatus, json: conv } = await apiJson<{ id: string }>(
      `/api/v1/projects/${projectId}/conversations`,
      session,
      { method: "POST", body: JSON.stringify({ title: "Phase 5K live" }) },
    );
    expectOk2xx(convStatus);
    const conversationId = conv.id;

    const { status: turnStatus, json: turn } = await apiJson<{
      status: string;
      mockAgent?: boolean;
      llmLive?: boolean;
      usage?: { inputTokens: number; outputTokens: number };
      results?: Array<{ toolName: string; success: boolean }>;
    }>(`/api/v1/projects/${projectId}/agent/creative-turn`, session, {
      method: "POST",
      body: JSON.stringify({
        userMessage: "Покажи фотографии проекта в библиотеке",
        conversationId,
        idempotencyKey: `phase5k-live-${Date.now()}`,
      }),
    });
    expectOk2xx(turnStatus);
    expect(turn.mockAgent).toBe(false);
    expect(turn.llmLive).toBe(true);
    expect(turn.status).toMatch(/completed|stopped/);
    const tokens = (turn.usage?.inputTokens ?? 0) + (turn.usage?.outputTokens ?? 0);
    const toolOk = turn.results?.some((r) => r.toolName === "search_project_assets" && r.success);
    expect(tokens > 0 || toolOk || Boolean(turn.assistantMessage)).toBe(true);
    expect(toolOk).toBe(true);

    const { json: jobs } = await apiJson<{ items: unknown[]; mock?: boolean }>(
      `/api/v1/projects/${projectId}/provider-jobs`,
      session,
    );
    expect(jobs.mock).toBe(true);
    expect(jobs.items?.length ?? 0).toBe(0);
  }, 120_000);
});

describe("Phase 5K live smoke gate", () => {
  it("skipped unless PHASE5K_LIVE_LLM_SMOKE=1", () => {
    if (!LIVE) {
      expect(integrationCredentials("A").email).toBeTruthy();
    }
  });
});
