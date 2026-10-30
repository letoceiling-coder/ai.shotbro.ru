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

/** 1 s of 16 kHz mono 16-bit PCM with a quiet tone — a valid voice-sample WAV. */
function toneWav(): Buffer {
  const rate = 16_000;
  const data = Buffer.alloc(rate * 2);
  for (let i = 0; i < rate; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function uploadReady(user: AuthSession, projectId: string, name: string, mimeType: string, body: Buffer): Promise<string> {
  const init = await apiJson<{ sessionId: string; uploadUrl: string }>("/api/v1/uploads/init", user, {
    method: "POST",
    body: JSON.stringify({ projectId, filename: name, mimeType, sizeBytes: body.length }),
  });
  expect(init.status).toBeLessThan(300);
  await fetch(init.json.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body });
  const done = await apiJson<{ assetId: string }>(`/api/v1/uploads/${init.json.sessionId}/complete`, user, {
    method: "POST",
    body: JSON.stringify({}),
  });
  expect(done.status).toBeLessThan(300);
  const assetId = done.json.assetId;
  for (let i = 0; i < 60; i++) {
    const list = await apiJson<{ items: Array<{ id: string; status: string }> }>(`/api/v1/projects/${projectId}/assets?limit=24`, user);
    const row = list.json.items?.find((a) => a.id === assetId);
    if (row?.status === "READY") return assetId;
    if (row?.status === "FAILED") throw new Error(`asset ${assetId} FAILED`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`asset ${assetId} not READY`);
}

type VoiceDto = {
  id: string;
  status: string;
  providerVoiceId?: string | null;
  previewAssetId?: string | null;
  previews: Array<{ generatedVoiceId: string; assetId: string | null }>;
  lastError?: string | null;
};

async function waitVoice(user: AuthSession, voiceId: string, done: (v: VoiceDto) => boolean): Promise<VoiceDto> {
  let last: VoiceDto | undefined;
  for (let i = 0; i < 60; i++) {
    const r = await apiJson<VoiceDto>(`/api/v1/voices/${voiceId}`, user);
    last = r.json;
    if (last.status === "FAILED") throw new Error(`voice FAILED: ${last.lastError}`);
    if (done(last)) return last;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`voice ${voiceId} timeout, last status ${last?.status}`);
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

type Quote = { approvalId: string | null; payloadHash: string | null; targetVersion: string | null; chargedUsd: number; estimatedLiveUsd: number; mock: boolean; free: boolean };

async function quote(user: AuthSession, body: Record<string, unknown>) {
  return apiJson<Quote>("/api/v1/talent/operations/quote", user, { method: "POST", body: JSON.stringify(body) });
}

async function decide(user: AuthSession, q: Quote, action: "approve" | "reject") {
  return apiJson<{ status: string }>(`/api/v1/approvals/${q.approvalId}/${action}`, user, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: q.targetVersion, payloadHash: q.payloadHash, idempotencyKey: `${action}-${q.approvalId}` }),
  });
}

describe("Phase 6B/6C talent jobs: quote → approve → worker (mock providers)", () => {
  let userA: AuthSession;
  let userB: AuthSession;
  let projectA: string;
  let projectB: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    userA = await signInIntegrationUser("A");
    userB = await signInIntegrationUser("B");
    const ts = Date.now();
    projectA = (await apiJson<{ id: string }>("/api/v1/projects", userA, { method: "POST", body: JSON.stringify({ title: `P6C A ${ts}` }) })).json.id;
    projectB = (await apiJson<{ id: string }>("/api/v1/projects", userB, { method: "POST", body: JSON.stringify({ title: `P6C B ${ts}` }) })).json.id;
  }, 60_000);

  it("paid operation without an approval is refused (409 approval_required)", async () => {
    const created = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "DESIGNED", name: "Без подтверждения", designPrompt: "Спокойный мужской голос для рекламы сайта shotbro" }),
    });
    const r = await apiJson("/api/v1/talent/operations", userA, {
      method: "POST",
      body: JSON.stringify({ projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: created.json.id }),
    });
    expect(r.status).toBe(409);
  });

  it("voice design: quote shows price → approve starts job → 3 previews → quote+approve save → READY", async () => {
    const created = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "DESIGNED", name: "Голос shotbro", designPrompt: "Уверенный дружелюбный мужской голос для рекламы студии видео, 30 лет" }),
    });
    const voiceId = created.json.id;
    const q = await quote(userA, { projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: voiceId });
    expect(q.status).toBeLessThan(300);
    expect(q.json).toMatchObject({ mock: true, chargedUsd: 0, free: false });
    expect(q.json.estimatedLiveUsd).toBeGreaterThan(0);
    expect(q.json.approvalId).toBeTruthy();

    // Nothing runs before the user decides.
    expect((await apiJson<VoiceDto>(`/api/v1/voices/${voiceId}`, userA)).json.status).toBe("DRAFT");

    expect((await decide(userA, q.json, "approve")).status).toBeLessThan(300);
    const designed = await waitVoice(userA, voiceId, (v) => v.status === "DRAFT" && v.previews.length === 3);
    expect(designed.previews.every((p) => p.assetId)).toBe(true);

    // Re-using the same approval returns the same job, never a second one.
    const replay = await apiJson<{ id: string }>("/api/v1/talent/operations", userA, {
      method: "POST",
      body: JSON.stringify({ projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: voiceId, approvalId: q.json.approvalId }),
    });
    expect([200, 201, 409]).toContain(replay.status);

    const badSave = await quote(userA, { projectId: projectA, operation: "VOICE_SAVE", voiceProfileId: voiceId, generatedVoiceId: "nope" });
    expect(badSave.status).toBe(400);

    const chosen = designed.previews[1]!;
    const qs = await quote(userA, { projectId: projectA, operation: "VOICE_SAVE", voiceProfileId: voiceId, generatedVoiceId: chosen.generatedVoiceId });
    expect(qs.status).toBeLessThan(300);
    await decide(userA, qs.json, "approve");
    const ready = await waitVoice(userA, voiceId, (v) => v.status === "READY");
    expect(ready.providerVoiceId).toBeTruthy();
    expect(ready.previewAssetId).toBe(chosen.assetId);
  }, 180_000);

  it("rejecting the card runs nothing; the rejected approval cannot start a job", async () => {
    const created = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "DESIGNED", name: "Отклонённый", designPrompt: "Мягкий женский голос для озвучки рекламы студии" }),
    });
    const q = await quote(userA, { projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: created.json.id });
    expect((await decide(userA, q.json, "reject")).status).toBeLessThan(300);
    const start = await apiJson("/api/v1/talent/operations", userA, {
      method: "POST",
      body: JSON.stringify({ projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: created.json.id, approvalId: q.json.approvalId }),
    });
    expect(start.status).toBe(409);
    expect((await apiJson<VoiceDto>(`/api/v1/voices/${created.json.id}`, userA)).json.status).toBe("DRAFT");
  });

  it("an approval cannot be reused for another operation or voice", async () => {
    const v1 = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "DESIGNED", name: "Первый", designPrompt: "Бодрый голос диктора для рекламы видео-студии" }),
    });
    const v2 = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "DESIGNED", name: "Второй", designPrompt: "Низкий голос диктора для трейлера рекламной кампании" }),
    });
    const q = await quote(userA, { projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: v1.json.id });
    const steal = await apiJson("/api/v1/talent/operations", userA, {
      method: "POST",
      body: JSON.stringify({ projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: v2.json.id, approvalId: q.json.approvalId }),
    });
    expect(steal.status).toBe(409);
    await decide(userA, q.json, "reject");
  });

  it("voice clone from WAV: consent required for the quote, then approve → READY", async () => {
    const sample = await uploadReady(userA, projectA, "voice-sample.wav", "audio/wav", toneWav());
    const created = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "CLONED", name: "Голос основателя", sampleAssetIds: [sample], labels: { language: "ru" } }),
    });
    const voiceId = created.json.id;
    expect((await quote(userA, { projectId: projectA, operation: "VOICE_CLONE", voiceProfileId: voiceId })).status).toBe(400);
    expect((await quote(userA, { projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: voiceId })).status).toBe(400);

    await apiJson(`/api/v1/voices/${voiceId}/consent`, userA, {
      method: "POST",
      body: JSON.stringify({ consentAssetId: sample, confirmed: true, textVersion: CONSENT_VERSION }),
    });
    const q = await quote(userA, { projectId: projectA, operation: "VOICE_CLONE", voiceProfileId: voiceId });
    expect(q.status).toBeLessThan(300);
    await decide(userA, q.json, "approve");
    const ready = await waitVoice(userA, voiceId, (v) => v.status === "READY");
    expect(ready.providerVoiceId).toMatch(/^mock-voice-/);
  }, 180_000);

  it("B cannot quote or run operations on A's voice, nor approve A's card", async () => {
    const created = await apiJson<{ id: string }>("/api/v1/voices", userA, {
      method: "POST",
      body: JSON.stringify({ kind: "DESIGNED", name: "Чужой", designPrompt: "Спокойный женский голос для озвучки рекламы сайта" }),
    });
    expect((await quote(userB, { projectId: projectB, operation: "VOICE_DESIGN", voiceProfileId: created.json.id })).status).toBe(404);
    expect((await quote(userB, { projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: created.json.id })).status).toBe(403);
    const q = await quote(userA, { projectId: projectA, operation: "VOICE_DESIGN", voiceProfileId: created.json.id });
    expect((await decide(userB, q.json, "approve")).status).toBe(403);
    await decide(userA, q.json, "reject");
  });

  it("avatar without HeyGen: free quote, photos become looks instantly", async () => {
    const photo = await uploadReady(userA, projectA, "face-6c.png", "image/png", png);
    const created = await apiJson<{ id: string; kind: string }>("/api/v1/avatars", userA, {
      method: "POST",
      body: JSON.stringify({ name: "Ведущий 6C", sourceAssetIds: [photo] }),
    });
    expect(created.json.kind).toBe("REFERENCE");
    const q = await quote(userA, { projectId: projectA, operation: "AVATAR_TRAIN", avatarProfileId: created.json.id });
    expect(q.json).toMatchObject({ free: true, approvalId: null, chargedUsd: 0 });
    const r = await apiJson<{ status: string; id: string | null }>("/api/v1/talent/operations", userA, {
      method: "POST",
      body: JSON.stringify({ projectId: projectA, operation: "AVATAR_TRAIN", avatarProfileId: created.json.id }),
    });
    expect(r.json).toMatchObject({ status: "READY", id: null });
    const avatar = await apiJson<{ status: string; looks: Array<{ previewAssetId: string; isDefault: boolean }> }>(
      `/api/v1/avatars/${created.json.id}`,
      userA,
    );
    expect(avatar.json.looks[0]).toMatchObject({ previewAssetId: photo, isDefault: true });
  }, 120_000);
});
