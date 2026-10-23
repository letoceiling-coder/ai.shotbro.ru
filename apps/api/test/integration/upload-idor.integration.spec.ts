import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, requireIntegrationEnv, signInIntegrationUser, type AuthSession } from "./http-helpers";

const png = readFileSync(resolve(process.cwd(), "test/fixtures/1x1.png"));

describe("Upload IDOR (integration)", () => {
  let userA: AuthSession;
  let userB: AuthSession;
  let sessionId: string;
  let projectId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    userA = await signInIntegrationUser("A");
    userB = await signInIntegrationUser("B");
    const ts = Date.now();
    const proj = await apiJson<{ id: string }>("/api/v1/projects", userA, {
      method: "POST",
      body: JSON.stringify({ title: `Upload IDOR ${ts}` }),
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

  it("A completes upload; B cannot get download URL", async () => {
    const done = await apiJson<{ assetId?: string }>(`/api/v1/uploads/${sessionId}/complete`, userA, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(done.status).toBeLessThan(300);
    const assetId = done.json.assetId;
    expect(assetId).toBeTruthy();
    const dl = await apiJson(`/api/v1/assets/${assetId}/download-url`, userB);
    expect(dl.status).toBeGreaterThanOrEqual(403);
  });
});
