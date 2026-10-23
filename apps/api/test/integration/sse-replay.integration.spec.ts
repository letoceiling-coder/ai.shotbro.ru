import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, expectOk2xx, requireIntegrationEnv, signUp, type AuthSession } from "./http-helpers";

const base = process.env.INTEGRATION_API_URL ?? "http://127.0.0.1:3021";

describe("SSE replay (integration)", () => {
  let session: AuthSession;
  let projectId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    const ts = Date.now();
    session = await signUp(`sse-${ts}@test.local`, "TestPass123!", "SSE");
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: "SSE test" }),
    });
    projectId = created.json.id;
  });

  it("stream returns events after user message; replay with Last-Event-ID", async () => {
    const convs = await apiJson<Array<{ id: string }>>(`/api/v1/projects/${projectId}/conversations`, session);
    const conversationId = convs.json[0]!.id;
    await apiJson(`/api/v1/conversations/${conversationId}/messages`, session, {
      method: "POST",
      body: JSON.stringify({ content: "sse ping", role: "user", idempotencyKey: `sse-${Date.now()}` }),
    });

    const stream1 = await fetch(`${base}/api/v1/projects/${projectId}/events/stream`, {
      headers: { Cookie: session.cookie, Origin: process.env.INTEGRATION_ORIGIN ?? "https://ai.shotbro.ru" },
    });
    expect(stream1.ok).toBe(true);
    const text1 = await stream1.text();
    expect(text1).toContain("message.created");
    const lastId = text1.match(/^id: (.+)$/m)?.[1];
    expect(lastId).toBeTruthy();

    const stream2 = await fetch(`${base}/api/v1/projects/${projectId}/events/stream`, {
      headers: {
        Cookie: session.cookie,
        "Last-Event-ID": lastId!,
        Origin: process.env.INTEGRATION_ORIGIN ?? "https://ai.shotbro.ru",
      },
    });
    const text2 = await stream2.text();
    expect(text2.includes("message.created")).toBe(false);
  });
});
