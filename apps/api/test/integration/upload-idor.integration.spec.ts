import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, requireIntegrationEnv, signUp, type AuthSession } from "./http-helpers";

const png = readFileSync(resolve(process.cwd(), "test/fixtures/1x1.png"));

describe("Upload IDOR (integration)", () => {
  let userA: AuthSession;
  let userB: AuthSession;
  let sessionId: string;
  let projectId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    const ts = Date.now();
    userA = await signUp(`up-a-${ts}@test.local`, "TestPass123!", "A");
    userB = await signUp(`up-b-${ts}@test.local`, "TestPass123!", "B");
    const proj = await apiJson<{ id: string }>("/api/v1/projects", userA, {
      method: "POST",
      body: JSON.stringify({ title: "Upload IDOR" }),
    });
    projectId = proj.json.id;
    const init = await apiJson<{ sessionId: string; uploadUrl: string }>("/api/v1/uploads/init", userA, {
      method: "POST",
      body: JSON.stringify({
        projectId,
        filename: "1x1.png",
        mimeType: "image/png",
        sizeBytes: png.length,
      }),
    });
    sessionId = init.json.sessionId;
    await fetch(init.json.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: png,
    });
  });

  it("B cannot complete A upload session", async () => {
    const done = await apiJson(`/api/v1/uploads/${sessionId}/complete`, userB, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(done.status).toBeGreaterThanOrEqual(400);
  });

  it("B cannot list A project assets", async () => {
    const assets = await apiJson(`/api/v1/projects/${projectId}/assets`, userB);
    expect(assets.status).toBe(403);
  });
});
