import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, apiRaw, requireIntegrationEnv, signUp, type AuthSession } from "./http-helpers";

describe("Security isolation (integration)", () => {
  let userA: AuthSession;
  let userB: AuthSession;
  let projectId: string;
  let conversationId: string;
  let messageId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    const ts = Date.now();
    userA = await signUp(`sec-a-${ts}@test.local`, "TestPass123!", "User A");
    userB = await signUp(`sec-b-${ts}@test.local`, "TestPass123!", "User B");

    const created = await apiJson<{ id: string }>("/api/v1/projects", userA, {
      method: "POST",
      body: JSON.stringify({ title: "SecTest Project", description: "iso" }),
    });
    expect(created.status).toBe(200);
    projectId = created.json.id;

    const convs = await apiJson<Array<{ id: string }>>(`/api/v1/projects/${projectId}/conversations`, userA);
    conversationId = convs.json[0]!.id;

    const msg = await apiJson<{ id: string }>(`/api/v1/conversations/${conversationId}/messages`, userA, {
      method: "POST",
      body: JSON.stringify({ content: "hello from A", role: "user", idempotencyKey: `k-${ts}` }),
    });
    expect(msg.status).toBe(200);
    messageId = msg.json.id;
  });

  it("B cannot list A project in own workspace list", async () => {
    const list = await apiJson<{ items: Array<{ id: string }> }>("/api/v1/projects", userB);
    expect(list.status).toBe(200);
    expect(list.json.items.some((p) => p.id === projectId)).toBe(false);
  });

  it("B cannot get A project by id", async () => {
    const res = await apiJson(`/api/v1/projects/${projectId}`, userB);
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  it("B cannot patch A project", async () => {
    const res = await apiJson(`/api/v1/projects/${projectId}`, userB, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hacked" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  it("B cannot delete A project", async () => {
    const res = await apiRaw(`/api/v1/projects/${projectId}`, userB, { method: "DELETE" });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  it("B cannot read A messages", async () => {
    const res = await apiJson(`/api/v1/conversations/${conversationId}/messages`, userB);
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  it("B cannot post into A conversation", async () => {
    const res = await apiJson(`/api/v1/conversations/${conversationId}/messages`, userB, {
      method: "POST",
      body: JSON.stringify({ content: "intrusion", role: "user" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  it("B cannot open SSE stream for A project", async () => {
    const res = await apiRaw(`/api/v1/projects/${projectId}/events/stream`, userB);
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  it("unauthenticated cannot access /users/me", async () => {
    const res = await fetch(`${process.env.INTEGRATION_API_URL ?? "http://127.0.0.1:3021"}/api/v1/users/me`);
    expect(res.status).toBe(401);
  });

  it("logout invalidates session for protected route", async () => {
    const ts = Date.now();
    const u = await signUp(`logout-${ts}@test.local`, "TestPass123!", "Logout User");
    const me1 = await apiJson("/api/v1/users/me", u);
    expect(me1.status).toBe(200);
    await apiRaw("/api/auth/sign-out", u, { method: "POST" });
    const me2 = await apiJson("/api/v1/users/me", u);
    expect(me2.status).toBe(401);
  });

  it("stores message id for attachment tests", () => {
    expect(messageId).toBeTruthy();
  });
});
