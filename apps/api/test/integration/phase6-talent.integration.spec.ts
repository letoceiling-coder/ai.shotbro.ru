import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { apiJson, requireIntegrationEnv, signInIntegrationUser, type AuthSession } from "./http-helpers";

const png = readFileSync(resolve(process.cwd(), "test/fixtures/1x1.png"));
const CONSENT_VERSION = "2026-10-30.v1";

async function uploadReadyPng(user: AuthSession, projectId: string, name: string): Promise<string> {
  const init = await apiJson<{ sessionId: string; uploadUrl: string }>("/api/v1/uploads/init", user, {
    method: "POST",
    body: JSON.stringify({ projectId, filename: name, mimeType: "image/png", sizeBytes: png.length }),
  });
  await fetch(init.json.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: png });
  const done = await apiJson<{ assetId: string }>(`/api/v1/uploads/${init.json.sessionId}/complete`, user, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const assetId = done.json.assetId;
  for (let i = 0; i < 60; i++) {
    const list = await apiJson<{ items: Array<{ id: string; status: string }> }>(
      `/api/v1/projects/${projectId}/assets?limit=24`,
      user,
    );
    const row = list.json.items?.find((a) => a.id === assetId);
    if (row?.status === "READY") return assetId;
    if (row?.status === "FAILED") throw new Error(`asset ${assetId} FAILED`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`asset ${assetId} not READY`);
}

describe("Phase 6A talent: avatars + voices (integration, mock)", () => {
  let userA: AuthSession;
  let userB: AuthSession;
  let projectA: string;
  let projectB: string;
  let imageA: string;
  let voiceA: string;
  let avatarA: string;
  let characterA: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    userA = await signInIntegrationUser("A");
    userB = await signInIntegrationUser("B");
    const ts = Date.now();
    projectA = (await apiJson<{ id: string }>("/api/v1/projects", userA, { method: "POST", body: JSON.stringify({ title: `P6 talent A ${ts}` }) })).json.id;
    projectB = (await apiJson<{ id: string }>("/api/v1/projects", userB, { method: "POST", body: JSON.stringify({ title: `P6 talent B ${ts}` }) })).json.id;
    imageA = await uploadReadyPng(userA, projectA, "p6-face.png");
    const ch = await apiJson<{ id: string }>(`/api/v1/projects/${projectA}/characters`, userA, {
      method: "POST",
      body: JSON.stringify({ name: "Ведущий shotbro.ru" }),
    });
    characterA = ch.json.id;
  }, 120_000);

  it("library voices are offline mock fixtures in mock mode", async () => {
    const r = await apiJson<{ items: Array<{ providerVoiceId: string }>; mock: boolean }>("/api/v1/voices/library", userA);
    expect(r.status).toBe(200);
    expect(r.json.mock).toBe(true);
    expect(r.json.items.length).toBeGreaterThan(0);
  });

  it("provider chain keeps customer order HeyGen → Fal → OpenRouter", async () => {
    const r = await apiJson<{ chain: Array<{ providerId: string }>; mockMode: boolean }>(
      "/api/v1/talent/provider-chain?capability=AVATAR_VIDEO",
      userA,
    );
    expect(r.status).toBe(200);
    expect(r.json.chain.map((c) => c.providerId)).toEqual(["heygen", "fal", "openrouter"]);
    expect(r.json.mockMode).toBe(true);
  });

  it("A picks a library voice → READY at once (free)", async () => {
    const r = await apiJson<{ id: string; status: string; kind: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "LIBRARY", name: "Диктор", providerVoiceId: "mock-ru-male-1", labels: { language: "ru" } }),
    });
    expect(r.status).toBeLessThan(300);
    expect(r.json).toMatchObject({ kind: "LIBRARY", status: "READY" });
    voiceA = r.json.id;
  });

  it("B cannot read, edit or archive A voice and does not see it", async () => {
    expect((await apiJson(`/api/v1/voices/${voiceA}`, userB)).status).toBe(404);
    expect((await apiJson(`/api/v1/voices/${voiceA}`, userB, { method: "PATCH", body: JSON.stringify({ name: "x" }) })).status).toBe(404);
    expect((await apiJson(`/api/v1/voices/${voiceA}`, userB, { method: "DELETE" })).status).toBe(404);
    const list = await apiJson<{ items: Array<{ id: string }> }>("/api/v1/voices", userB);
    expect(list.json.items.some((v) => v.id === voiceA)).toBe(false);
  });

  it("cloning needs audio samples (image rejected)", async () => {
    const r = await apiJson("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "CLONED", name: "Мой голос", sampleAssetIds: [imageA] }),
    });
    expect(r.status).toBe(400);
  });

  it("B cannot build an avatar from A's photo", async () => {
    const r = await apiJson("/api/v1/avatars", userB, {
      method: "POST",
      body: JSON.stringify({ name: "Чужое лицо", sourceAssetIds: [imageA] }),
    });
    expect(r.status).toBe(403);
  });

  it("A creates an avatar draft with default voice; route follows the provider chain", async () => {
    const r = await apiJson<{ id: string; status: string; kind: string; defaultVoiceProfileId: string }>("/api/v1/avatars", userA, {
      method: "POST",
      body: JSON.stringify({ name: "Ведущий", sourceAssetIds: [imageA], defaultVoiceProfileId: voiceA }),
    });
    expect(r.status).toBeLessThan(300);
    expect(r.json.status).toBe("DRAFT");
    expect(["PHOTO", "REFERENCE"]).toContain(r.json.kind);
    expect(r.json.defaultVoiceProfileId).toBe(voiceA);
    avatarA = r.json.id;
    expect((await apiJson(`/api/v1/avatars/${avatarA}`, userB)).status).toBe(404);
  });

  it("consent requires the current text version", async () => {
    const bad = await apiJson(`/api/v1/avatars/${avatarA}/consent`, userA, {
      method: "POST",
      body: JSON.stringify({ consentAssetId: imageA, confirmed: true, textVersion: "old" }),
    });
    expect(bad.status).toBe(400);
    const good = await apiJson<{ consent: { textVersion: string } }>(`/api/v1/avatars/${avatarA}/consent`, userA, {
      method: "POST",
      body: JSON.stringify({ consentAssetId: imageA, confirmed: true, textVersion: CONSENT_VERSION }),
    });
    expect(good.status).toBeLessThan(300);
    expect(good.json.consent.textVersion).toBe(CONSENT_VERSION);
  });

  it("A links avatar + voice to a project character; edits keep the links", async () => {
    const r = await apiJson<{ voiceProfileId?: string; avatarProfileId?: string }>(
      `/api/v1/projects/${projectA}/characters/${characterA}/talent`,
      userA,
      { method: "PATCH", body: JSON.stringify({ voiceProfileId: voiceA, avatarProfileId: avatarA }) },
    );
    expect(r.status).toBeLessThan(300);
    expect(r.json).toMatchObject({ voiceProfileId: voiceA, avatarProfileId: avatarA });

    await apiJson(`/api/v1/projects/${projectA}/characters`, userA, {
      method: "POST",
      body: JSON.stringify({ id: characterA, name: "Ведущий shotbro.ru", appearance: "в чёрной футболке" }),
    });
    const list = await apiJson<{ items: Array<{ id: string; voiceProfileId?: string; avatarProfileId?: string }> }>(
      `/api/v1/projects/${projectA}/characters`,
      userA,
    );
    expect(list.json.items.find((c) => c.id === characterA)).toMatchObject({ voiceProfileId: voiceA, avatarProfileId: avatarA });
  });

  it("B cannot link A's talent to B's project, nor touch A's character", async () => {
    const chB = await apiJson<{ id: string }>(`/api/v1/projects/${projectB}/characters`, userB, {
      method: "POST",
      body: JSON.stringify({ name: "B char" }),
    });
    const steal = await apiJson(`/api/v1/projects/${projectB}/characters/${chB.json.id}/talent`, userB, {
      method: "PATCH",
      body: JSON.stringify({ voiceProfileId: voiceA }),
    });
    expect(steal.status).toBe(400);
    const cross = await apiJson(`/api/v1/projects/${projectA}/characters/${characterA}/talent`, userB, {
      method: "PATCH",
      body: JSON.stringify({ voiceProfileId: null }),
    });
    expect(cross.status).toBe(403);
  });

  it("archived voice cannot be linked any more", async () => {
    expect((await apiJson(`/api/v1/voices/${voiceA}`, userA, { method: "DELETE" })).status).toBeLessThan(300);
    const r = await apiJson(`/api/v1/projects/${projectA}/characters/${characterA}/talent`, userA, {
      method: "PATCH",
      body: JSON.stringify({ voiceProfileId: voiceA }),
    });
    expect(r.status).toBe(400);
  });
});
