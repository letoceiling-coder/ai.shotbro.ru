import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, requireIntegrationEnv, signInIntegrationUser, type AuthSession } from "./http-helpers";

const base = process.env.INTEGRATION_API_URL ?? "http://127.0.0.1:3021";

describe("SSE replay (integration)", () => {
  let session: AuthSession;
  let projectId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    session = await signInIntegrationUser("A");
    const ts = Date.now();
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: `SSE test ${ts}` }),
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

    const ac = new AbortController();
    const stream1 = await fetch(`${base}/api/v1/projects/${projectId}/events/stream`, {
      headers: { Cookie: session.cookie, Origin: process.env.INTEGRATION_ORIGIN ?? "https://ai.shotbro.ru" },
      signal: ac.signal,
    });
    expect(stream1.ok).toBe(true);
    const reader = stream1.body!.getReader();
    const decoder = new TextDecoder();
    let text1 = "";
    for (let i = 0; i < 30; i++) {
      const { value, done } = await reader.read();
      if (value) text1 += decoder.decode(value, { stream: true });
      if (text1.includes("message.created")) break;
      if (done) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    ac.abort();
    expect(text1).toContain("message.created");
    const lastId = text1.match(/^id: ([^\s\r\n]+)\r?\nevent: message\.created/m)?.[1];
    expect(lastId).toBeTruthy();

    const listReplay = await apiJson<unknown[]>(
      `/api/v1/projects/${projectId}/events?after=${encodeURIComponent(lastId!)}`,
      session,
    );
    expect(listReplay.status).toBe(200);
    expect(Array.isArray(listReplay.json) ? listReplay.json.length : 0).toBe(0);

    const ac2 = new AbortController();
    const stream2 = await fetch(
      `${base}/api/v1/projects/${projectId}/events/stream?after=${encodeURIComponent(lastId!)}`,
      {
        headers: {
          Cookie: session.cookie,
          Origin: process.env.INTEGRATION_ORIGIN ?? "https://ai.shotbro.ru",
        },
        signal: ac2.signal,
      },
    );
    const reader2 = stream2.body!.getReader();
    let text2 = "";
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader2.read();
      if (value) text2 += decoder.decode(value, { stream: true });
      if (done) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    ac2.abort();
    expect(text2).not.toMatch(/event: message\.created/);
  });
});
