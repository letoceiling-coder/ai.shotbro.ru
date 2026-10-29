import { describe, expect, it } from "vitest";
import {
  apiJson,
  expectOk2xx,
  integrationCredentials,
  requireIntegrationEnv,
  signInIntegrationUser,
  type AuthSession,
} from "./http-helpers";

describe("Phase 5L-A creative-turn idempotency (integration)", () => {
  it("duplicate idempotencyKey returns same runId without extra agent runs", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    const ts = Date.now();
    const { json: created } = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: `5L-idem-${ts}`, settings: {} }),
    });
    const projectId = created.id;
    const { json: conv } = await apiJson<{ id: string }>(
      `/api/v1/projects/${projectId}/conversations`,
      session,
      { method: "POST", body: JSON.stringify({ title: "5L idem" }) },
    );
    const conversationId = conv.id;
    const idempotencyKey = `5l-idem-${ts}`;
    const body = {
      userMessage: "phase5k: покажи библиотеку фото",
      conversationId,
      idempotencyKey,
    };

    const first = await postTurn(session, projectId, body);
    expectOk2xx(first.status);
    expect(first.json.runId).toBeTruthy();

    const second = await postTurn(session, projectId, body);
    expectOk2xx(second.status);
    expect(second.json.runId).toBe(first.json.runId);

    const runId = first.json.runId!;
    const fetched = await apiJsonWith429Retry<{ id: string }>(
      `/api/v1/projects/${projectId}/agent/runs/${runId}`,
      session,
    );
    expectOk2xx(fetched.status);
    expect(fetched.json.id).toBe(runId);
  }, 120_000);

  it("same client key on two projects creates isolated runs", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    const ts = Date.now();
    const idempotencyKey = `5l-shared-client-key-${ts}`;
    const p1 = await createProject(session, ts);
    const p2 = await createProject(session, ts + 1);
    const c1 = await createConversation(session, p1);
    const c2 = await createConversation(session, p2);

    const r1 = await postTurn(session, p1, {
      userMessage: "phase5k: библиотека",
      conversationId: c1,
      idempotencyKey,
    });
    const r2 = await postTurn(session, p2, {
      userMessage: "phase5k: библиотека",
      conversationId: c2,
      idempotencyKey,
    });
    expectOk2xx(r1.status);
    expectOk2xx(r2.status);
    expect(r1.json.runId).not.toBe(r2.json.runId);
  }, 120_000);
});

async function postTurn(
  session: AuthSession,
  projectId: string,
  body: { userMessage: string; conversationId: string; idempotencyKey: string },
) {
  return apiJsonWith429Retry<{ runId?: string; status: string }>(
    `/api/v1/projects/${projectId}/agent/creative-turn`,
    session,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/** Staging throttler may return 429 after long E2E; respect Retry-After without weakening prod limits. */
async function apiJsonWith429Retry<T>(
  path: string,
  session: AuthSession,
  init?: RequestInit,
  maxAttempts = 8,
) {
  const base = process.env.INTEGRATION_API_URL ?? "http://127.0.0.1:3021";
  const gate = process.env.STAGING_GATE_SECRET;
  const hdrs = (extra: Record<string, string> = {}) => {
    const h: Record<string, string> = { ...extra };
    if (gate) h["X-Shotbro-Staging-Gate"] = gate;
    return h;
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: hdrs({
        "Content-Type": "application/json",
        Cookie: session.cookie,
        ...(init?.headers as Record<string, string>),
      }),
    });
    if (res.status === 429 && attempt + 1 < maxAttempts) {
      const retryAfter = res.headers.get("Retry-After");
      const waitSec = retryAfter ? Math.min(parseInt(retryAfter, 10) || 5, 60) : 5;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, json };
  }
  return apiJson<T>(path, session, init);
}

async function createProject(session: AuthSession, ts: number) {
  const { json: created } = await apiJson<{ id: string }>("/api/v1/projects", session, {
    method: "POST",
    body: JSON.stringify({ title: `5L-${ts}`, settings: {} }),
  });
  return created.id;
}

async function createConversation(session: AuthSession, projectId: string) {
  const { json: conv } = await apiJson<{ id: string }>(
    `/api/v1/projects/${projectId}/conversations`,
    session,
    { method: "POST", body: JSON.stringify({ title: "5L" }) },
  );
  return conv.id;
}

describe("Phase 5L-A idempotency gate", () => {
  it("skipped unless RUN_INTEGRATION_TESTS=1", () => {
    if (process.env.RUN_INTEGRATION_TESTS !== "1") {
      expect(integrationCredentials("A").email).toBeTruthy();
    }
  });
});
