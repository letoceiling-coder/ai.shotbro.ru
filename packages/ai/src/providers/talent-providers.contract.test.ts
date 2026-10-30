import { describe, expect, it } from "vitest";
import type { AppEnv } from "@shotbro/config/env";
import type { HttpRequest, HttpResponse, HttpTransport } from "./http-transport.js";
import { HeyGenAvatarAdapter } from "./heygen-avatar-adapter.js";
import { ElevenLabsVoiceAdapter } from "./elevenlabs-voice-adapter.js";
import { MockElevenLabsVoiceProvider, MockHeyGenAvatarProvider } from "./mock-talent-providers.js";
import { resolveMediaProviderChain } from "./media-provider-chain.js";

const baseEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  HEYGEN_API_KEY: "hg-test-key-12345678",
  HEYGEN_BASE_URL: "https://api.heygen.com",
  HEYGEN_PROVIDER_ENABLED: false,
  ELEVENLABS_API_KEY: "el-test-key-12345678",
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io",
  ELEVENLABS_PROVIDER_ENABLED: false,
  FAL_API_KEY: undefined,
  FAL_PROVIDER_ENABLED: false,
  OPENROUTER_API_KEY: "or-test-key-12345678",
  OPENROUTER_ENABLED: true,
} as unknown as AppEnv;

const liveEnv = { ...baseEnv, AI_MOCK_MODE: false, PROVIDER_LIVE_EXECUTION_ENABLED: true } as AppEnv;

/** Records requests and answers by "METHOD url" (prefix match for query strings). */
class RecordingTransport implements HttpTransport {
  readonly calls: HttpRequest[] = [];
  constructor(private readonly routes: Record<string, HttpResponse>) {}
  async request(req: HttpRequest): Promise<HttpResponse> {
    this.calls.push(req);
    const key = `${req.method} ${req.url}`;
    const hit = this.routes[key] ?? Object.entries(this.routes).find(([k]) => key.startsWith(k))?.[1];
    if (!hit) throw new Error(`No fixture for ${key}`);
    return hit;
  }
}

const ok = (body: unknown): HttpResponse => ({ status: 200, headers: {}, body });

describe("resolveMediaProviderChain (HeyGen → Fal → OpenRouter)", () => {
  it("falls back to OpenRouter when HeyGen is off and Fal has no key", () => {
    const chain = resolveMediaProviderChain(baseEnv, "AVATAR_VIDEO");
    expect(chain.chain.map((c) => c.providerId)).toEqual(["heygen", "fal", "openrouter"]);
    expect(chain.selected).toBe("openrouter");
    expect(chain.chain[1]!.reason).toMatch(/FAL_API_KEY/);
  });

  it("prefers HeyGen when key + switch present, with persistent identity", () => {
    const chain = resolveMediaProviderChain({ ...baseEnv, HEYGEN_PROVIDER_ENABLED: true } as AppEnv, "AVATAR_TRAIN");
    expect(chain.selected).toBe("heygen");
    expect(chain.chain[0]!.persistentIdentity).toBe(true);
  });

  it("uses Fal before OpenRouter when Fal is configured", () => {
    const env = { ...baseEnv, FAL_API_KEY: "fal-test-key-123456", FAL_PROVIDER_ENABLED: true } as AppEnv;
    expect(resolveMediaProviderChain(env, "SCENE_VIDEO").selected).toBe("fal");
  });

  it("never routes scene video to direct HeyGen", () => {
    const env = { ...baseEnv, HEYGEN_PROVIDER_ENABLED: true } as AppEnv;
    const chain = resolveMediaProviderChain(env, "SCENE_VIDEO");
    expect(chain.chain[0]!.available).toBe(false);
    expect(chain.selected).toBe("openrouter");
  });

  it("returns null when nothing is configured", () => {
    const env = { ...baseEnv, OPENROUTER_ENABLED: false } as AppEnv;
    expect(resolveMediaProviderChain(env, "AVATAR_VIDEO").selected).toBeNull();
  });
});

describe("HeyGenAvatarAdapter contract", () => {
  it("blocks network in mock mode", async () => {
    const t = new RecordingTransport({});
    const a = new HeyGenAvatarAdapter(baseEnv, t);
    await expect(a.submit("heygen", "AVATAR_TRAIN", { name: "A", imageKeys: ["k1"] }, { idempotencyKey: "x" })).rejects.toBeTruthy();
    expect(t.calls).toHaveLength(0);
  });

  it("trains: create group → add looks → train, returns train:<group>", async () => {
    const base = "https://api.heygen.com";
    const t = new RecordingTransport({
      [`POST ${base}/v2/photo_avatar/avatar_group/create`]: ok({ data: { group_id: "g1" } }),
      [`POST ${base}/v2/photo_avatar/avatar_group/add`]: ok({ data: {} }),
      [`POST ${base}/v2/photo_avatar/train`]: ok({ data: {} }),
    });
    const r = await new HeyGenAvatarAdapter(liveEnv, t).submit(
      "heygen",
      "AVATAR_TRAIN",
      { name: "Shotbro host", imageKeys: ["k1", "k2"] },
      { idempotencyKey: "x" },
    );
    expect(r).toMatchObject({ status: "SUBMITTED", providerJobId: "train:g1" });
    expect(t.calls.map((c) => c.url.replace(base, ""))).toEqual([
      "/v2/photo_avatar/avatar_group/create",
      "/v2/photo_avatar/avatar_group/add",
      "/v2/photo_avatar/train",
    ]);
    expect(t.calls[0]!.headers?.["X-Api-Key"]).toBe("hg-test-key-12345678");
  });

  it("video uses talking_photo + our own audio", async () => {
    const t = new RecordingTransport({ "POST https://api.heygen.com/v2/video/generate": ok({ data: { video_id: "v9" } }) });
    const r = await new HeyGenAvatarAdapter(liveEnv, t).submit(
      "heygen",
      "AVATAR_VIDEO",
      { talkingPhotoId: "look1", audioUrl: "https://ai.shotbro.ru/signed/a.mp3" },
      { idempotencyKey: "x" },
    );
    expect(r.providerJobId).toBe("video:v9");
    const body = t.calls[0]!.body as { video_inputs: Array<{ character: unknown; voice: unknown }> };
    expect(body.video_inputs[0]!.character).toEqual({ type: "talking_photo", talking_photo_id: "look1" });
    expect(body.video_inputs[0]!.voice).toEqual({ type: "audio", audio_url: "https://ai.shotbro.ru/signed/a.mp3" });
  });

  it("rejects video without audio or text+voice", () => {
    const a = new HeyGenAvatarAdapter(liveEnv, new RecordingTransport({}));
    expect(() => a.validateRequest("heygen", "AVATAR_VIDEO", { talkingPhotoId: "l" })).toThrow();
  });

  it("polls training and returns looks when ready", async () => {
    const base = "https://api.heygen.com";
    const t = new RecordingTransport({
      [`GET ${base}/v2/photo_avatar/train/status/g1`]: ok({ data: { status: "ready" } }),
      [`GET ${base}/v2/avatar_group/g1/avatars`]: ok({ data: { avatar_list: [{ id: "look1", name: "Офис" }] } }),
    });
    const s = await new HeyGenAvatarAdapter(liveEnv, t).getStatus("train:g1");
    expect(s.status).toBe("COMPLETED");
    expect(s.outputs?.[0]).toMatchObject({ externalId: "look1", label: "Офис" });
  });

  it("maps 401 to INVALID_CREDENTIALS", async () => {
    const t = new RecordingTransport({
      "POST https://api.heygen.com/v2/video/generate": { status: 401, headers: {}, body: { error: "bad key" } },
    });
    await expect(
      new HeyGenAvatarAdapter(liveEnv, t).submit("heygen", "AVATAR_VIDEO", { talkingPhotoId: "l", audioUrl: "https://x.ru/a.mp3" }, { idempotencyKey: "x" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

describe("ElevenLabsVoiceAdapter contract", () => {
  const sample = { filename: "s.mp3", contentType: "audio/mpeg", data: Buffer.from("abc") };

  it("refuses cloning without verified consent", () => {
    const a = new ElevenLabsVoiceAdapter(liveEnv, new RecordingTransport({}));
    expect(() => a.validateRequest("ivc", "VOICE_CLONE", { name: "Я", files: [sample] })).toThrow();
  });

  it("clones via multipart POST /v1/voices/add without JSON content-type", async () => {
    const t = new RecordingTransport({ "POST https://api.elevenlabs.io/v1/voices/add": ok({ voice_id: "vX", requires_verification: false }) });
    const r = await new ElevenLabsVoiceAdapter(liveEnv, t).submit(
      "ivc",
      "VOICE_CLONE",
      { name: "Голос бренда", files: [sample], labels: { language: "ru" }, consentVerified: true },
      { idempotencyKey: "x" },
    );
    expect(r.outputs?.[0]?.externalId).toBe("vX");
    const req = t.calls[0]!;
    expect(req.headers?.["Content-Type"]).toBeUndefined();
    expect(req.multipart?.filter((p) => p.name === "files")).toHaveLength(1);
    expect(req.multipart?.find((p) => p.name === "labels")).toMatchObject({ value: JSON.stringify({ language: "ru" }) });
  });

  it("design returns previews with generated ids", async () => {
    const t = new RecordingTransport({
      "POST https://api.elevenlabs.io/v1/text-to-voice/design": ok({
        previews: [
          { generated_voice_id: "g1", audio_base_64: "AAA", media_type: "audio/mpeg", duration_secs: 5 },
          { generated_voice_id: "g2", audio_base_64: "BBB" },
        ],
      }),
    });
    const r = await new ElevenLabsVoiceAdapter(liveEnv, t).submit(
      "eleven_multilingual_ttv_v2",
      "VOICE_DESIGN",
      { voiceDescription: "Уверенный мужской голос диктора рекламы, 35 лет" },
      { idempotencyKey: "x" },
    );
    expect(r.outputs?.map((o) => o.externalId)).toEqual(["g1", "g2"]);
    expect((t.calls[0]!.body as { auto_generate_text?: boolean }).auto_generate_text).toBe(true);
  });

  it("blocks library listing in mock mode (no network)", async () => {
    const t = new RecordingTransport({});
    await expect(new ElevenLabsVoiceAdapter(baseEnv, t).listVoices()).rejects.toBeTruthy();
    expect(t.calls).toHaveLength(0);
  });
});

describe("mock talent providers", () => {
  it("mock voice library is Russian-first and offline", async () => {
    const voices = await new MockElevenLabsVoiceProvider().listVoices();
    expect(voices.some((v) => v.labels.language === "ru")).toBe(true);
  });

  it("mock design yields 3 previews deterministically", async () => {
    const p = new MockElevenLabsVoiceProvider();
    const input = { voiceDescription: "Спокойный женский голос для рекламы студии" };
    const a = await p.submit("m", "VOICE_DESIGN", input);
    const b = await p.submit("m", "VOICE_DESIGN", input);
    expect(a.outputs).toHaveLength(3);
    expect(a.providerJobId).toBe(b.providerJobId);
  });

  it("mock avatar training completes with looks on first poll", async () => {
    const p = new MockHeyGenAvatarProvider();
    const sub = await p.submit("m", "AVATAR_TRAIN", { name: "A", imageKeys: ["k"] });
    const st = await p.getStatus(sub.providerJobId!);
    expect(st.status).toBe("COMPLETED");
    expect(st.outputs.length).toBeGreaterThan(0);
  });
});

describe("createTalentAdapters (Phase 6B gates)", () => {
  // Imported lazily to keep the contract tests above independent of the gate module.
  it("mock mode always yields mock adapters with reasons", async () => {
    const { createTalentAdapters } = await import("./talent-adapters.js");
    const set = createTalentAdapters(baseEnv, "VOICE_CLONE", { approved: true });
    expect(set.mock).toBe(true);
    expect(set.reasons.join(" ")).toMatch(/LIVE_APPROVED/);
  });

  it("live flags without approval or feature switch stay blocked", async () => {
    const { liveTalentBlockers } = await import("./talent-adapters.js");
    const env = { ...liveEnv, ELEVENLABS_PROVIDER_ENABLED: true, VOICE_CLONING_ENABLED: false } as AppEnv;
    const reasons = liveTalentBlockers(env, "VOICE_CLONE", { approved: false });
    expect(reasons).toEqual(expect.arrayContaining(["VOICE_CLONING_ENABLED=false", "no approved cost confirmation"]));
  });

  it("avatar training needs HeyGen key, vendor switch and avatar switch", async () => {
    const { liveTalentBlockers } = await import("./talent-adapters.js");
    const env = { ...liveEnv, HEYGEN_API_KEY: undefined } as unknown as AppEnv;
    const reasons = liveTalentBlockers(env, "AVATAR_TRAIN", { approved: true });
    expect(reasons).toEqual(expect.arrayContaining(["HEYGEN_PROVIDER_ENABLED=false", "HEYGEN_API_KEY missing", "AVATAR_GENERATION_ENABLED=false"]));
  });
});

describe("ElevenLabs block pages (6G)", () => {
  it("an HTML page instead of JSON is an error, not an empty catalog", async () => {
    const t: HttpTransport = {
      request: async (_req: HttpRequest): Promise<HttpResponse> => ({ status: 200, headers: { "content-type": "text/html" }, body: "<!doctype html><html></html>" }),
    };
    await expect(new ElevenLabsVoiceAdapter(liveEnv, t).listVoices()).rejects.toBeTruthy();
  });
});
