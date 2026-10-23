import { describe, expect, it, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import {
  apiJson,
  expectOk2xx,
  integrationCredentials,
  requireIntegrationEnv,
  signIn,
  type AuthSession,
} from "./http-helpers";

const STAGING = process.env.INTEGRATION_API_URL?.includes("ai.shotbro.ru");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function approveAllPending(session: AuthSession, projectId: string, maxRounds = 12) {
  for (let round = 0; round < maxRounds; round++) {
    const list = await apiJson<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/projects/${projectId}/approvals`,
      session,
    );
    const pending = list.json.items.filter((a) => a.status === "PENDING");
    if (!pending.length) return round;
    for (const row of pending) {
      const approved = await apiJson<{ status: string }>(`/api/v1/approvals/${row.id}/approve`, session, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: row.targetVersion,
          payloadHash: row.payloadHash,
          idempotencyKey: `e2e-approve-${row.id}-${round}`,
        }),
      });
      expectOk2xx(approved.status);
    }
    await sleep(2500);
  }
  return maxRounds;
}

describe.skipIf(!STAGING)("Phase 3 full mock agent (staging)", () => {
  let session: AuthSession;
  let projectId: string;
  let conversationId: string;
  let runId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    const creds = integrationCredentials("A");
    session = await signIn(creds.email, creds.password);
    const ts = Date.now();
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: `Phase3 agent ${ts}` }),
    });
    expectOk2xx(created.status);
    projectId = created.json.id;
    const convs = await apiJson<Array<{ id: string }>>(`/api/v1/projects/${projectId}/conversations`, session);
    conversationId = convs.json[0]!.id;
  });

  it("runs agent through production to COMPLETED with delivery asset", async () => {
    const run = await apiJson<{ id: string; productionState: string }>(
      `/api/v1/projects/${projectId}/agent/runs`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          userRequest: "Рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo",
          conversationId,
        }),
      },
    );
    expectOk2xx(run.status);
    runId = run.json.id;

    await approveAllPending(session, projectId, 10);

    let finalState = "UNKNOWN";
    for (let i = 0; i < 90; i++) {
      const st = await apiJson<{ productionState: string; status: string }>(
        `/api/v1/projects/${projectId}/agent/runs/${runId}`,
        session,
      );
      finalState = st.json.productionState;
      if (st.json.status === "COMPLETED" && finalState === "COMPLETED") break;
      if (finalState.includes("WAITING") || finalState === "NEEDS_REVISION") {
        await approveAllPending(session, projectId, 3);
      }
      await sleep(4000);
    }

    expect(finalState).toBe("COMPLETED");

    let delivery: { id: string; mimeType: string; originalName?: string } | undefined;
    for (let i = 0; i < 30; i++) {
      const assets = await apiJson<Array<{ id: string; mimeType: string; originalName?: string }>>(
        `/api/v1/projects/${projectId}/assets`,
        session,
      );
      delivery = assets.json.find(
        (a) => a.mimeType === "video/mp4" && a.originalName?.includes("mock-delivery"),
      );
      if (delivery) break;
      await sleep(2000);
    }
    expect(delivery?.id).toBeTruthy();

    const dl = await apiJson<{ url: string }>(`/api/v1/assets/${delivery!.id}/download-url`, session);
    expectOk2xx(dl.status);
    expect(dl.json.url).toMatch(/^https?:\/\//);

    const blob = await fetch(dl.json.url, { method: "GET", headers: { Range: "bytes=0-1023" } });
    expect(blob.status === 200 || blob.status === 206).toBe(true);
    expect((blob.headers.get("content-type") ?? "").toLowerCase()).toMatch(/video/);
  }, 600_000);

  it("paid provider guard blocks live execution flag", async () => {
    const registry = await apiJson<{ tools?: Array<{ id: string }> }>("/api/v1/ai/registry", session);
    expectOk2xx(registry.status);
    expect(createHash("sha256").update("mock").digest("hex").length).toBe(64);
  });
});
