import { describe, expect, it } from "vitest";
import { MockHttpTransport } from "./http-transport.js";
import { OpenRouterImageAdapter, OpenRouterTtsAdapter, OpenRouterVideoAdapter } from "./openrouter-media-adapters.js";

const env = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  OPENROUTER_API_KEY: "or-test-key",
} as import("@shotbro/config/env").AppEnv;

describe("OpenRouter media adapters (mock transport)", () => {
  it("image adapter blocks live network under MOCK_ONLY", async () => {
    const transport = new MockHttpTransport({
      "POST https://openrouter.ai/api/v1/images": { status: 200, headers: {}, body: { data: [{ url: "https://x/img.png" }] } },
    });
    const adapter = new OpenRouterImageAdapter(env, transport);
    await expect(
      adapter.submit("openrouter/image/auto", "TEXT_TO_IMAGE", { prompt: "test" }, { idempotencyKey: "k1" }),
    ).rejects.toThrow(/blocked/i);
  });

  it("video adapter serializes POST /videos", async () => {
    let url = "";
    const transport = new MockHttpTransport({});
    transport.request = async (req) => {
      url = req.url;
      return { status: 200, headers: {}, body: { id: "vid-job-1" } };
    };
    const adapter = new OpenRouterVideoAdapter(
      { ...env, AI_MOCK_MODE: false, PROVIDER_LIVE_EXECUTION_ENABLED: true, OPENROUTER_ENABLED: true, OPENROUTER_ALLOW_PAID_REQUESTS: true },
      transport,
    );
    const res = await adapter.submit("openrouter/video/auto", "TEXT_TO_VIDEO", { prompt: "motion" }, { idempotencyKey: "k2" });
    expect(url).toContain("/videos");
    expect(res.providerJobId).toBe("vid-job-1");
  });

  const liveEnv = { ...env, AI_MOCK_MODE: false, PROVIDER_LIVE_EXECUTION_ENABLED: true, OPENROUTER_ENABLED: true } as typeof env;

  it("image adapter: POST /images body and b64_json output (6G API shape)", async () => {
    let sent: Record<string, unknown> = {};
    const transport = new MockHttpTransport({});
    transport.request = async (req) => {
      sent = req.body as Record<string, unknown>;
      return { status: 200, headers: {}, body: { data: [{ b64_json: "aGVsbG8=", media_type: "image/png" }], usage: { cost: 0.018 } } };
    };
    const res = await new OpenRouterImageAdapter(liveEnv, transport).submit(
      "bytedance-seed/seedream-5-0-flash",
      "TEXT_TO_IMAGE",
      { prompt: "logo", aspect_ratio: "9:16", resolution: "1K" },
      { idempotencyKey: "i1" },
    );
    expect(sent).toMatchObject({ model: "bytedance-seed/seedream-5-0-flash", prompt: "logo", aspect_ratio: "9:16", n: 1 });
    expect(res.outputs?.[0]).toMatchObject({ base64: "aGVsbG8=", mimeType: "image/png" });
    expect(res.usage).toEqual({ costUsd: 0.018 });
  });

  it("video adapter: duration + frame_images, status mapping, binary download", async () => {
    const calls: Array<{ url: string; body?: unknown; responseType?: string }> = [];
    const transport = new MockHttpTransport({});
    transport.request = async (req) => {
      calls.push({ url: req.url, body: req.body, responseType: req.responseType });
      if (req.method === "POST") return { status: 202, headers: {}, body: { id: "job-1", status: "pending" } };
      if (req.url.endsWith("/content?index=0")) return { status: 200, headers: {}, body: Buffer.from("mp4") };
      return { status: 200, headers: {}, body: { status: "completed", usage: { cost: 0.07 } } };
    };
    const a = new OpenRouterVideoAdapter(liveEnv, transport);
    const sub = await a.submit(
      "x-ai/grok-imagine-video-1.5-lite",
      "IMAGE_TO_VIDEO",
      { prompt: "zoom", duration: 3, resolution: "480p", aspect_ratio: "9:16", first_frame_url: "https://ai.shotbro.ru/f.png", generate_audio: false },
      { idempotencyKey: "v1" },
    );
    expect(sub.providerJobId).toBe("job-1");
    expect(calls[0]!.body).toMatchObject({
      duration: 3,
      frame_images: [{ type: "image_url", image_url: { url: "https://ai.shotbro.ru/f.png" }, frame_type: "first_frame" }],
    });
    expect(await a.getStatus("job-1")).toMatchObject({ status: "COMPLETED", costUsd: 0.07 });
    expect((await a.downloadContent("job-1")).toString()).toBe("mp4");
    expect(calls.at(-1)!.responseType).toBe("binary");
  });

  it("video adapter: avatar photo goes as input_references (heygen/avatar-iv rejects frame_images)", async () => {
    let sent: Record<string, unknown> = {};
    const transport = new MockHttpTransport({});
    transport.request = async (req) => {
      sent = req.body as Record<string, unknown>;
      return { status: 202, headers: {}, body: { id: "job-av" } };
    };
    await new OpenRouterVideoAdapter(liveEnv, transport).submit(
      "heygen/avatar-iv",
      "IMAGE_TO_VIDEO",
      { prompt: "Привет!", aspect_ratio: "9:16", resolution: "720p", reference_urls: ["https://ai.shotbro.ru/p.jpg"] },
      { idempotencyKey: "av1" },
    );
    expect(sent).toEqual({
      model: "heygen/avatar-iv",
      prompt: "Привет!",
      resolution: "720p",
      aspect_ratio: "9:16",
      input_references: [{ type: "image_url", image_url: { url: "https://ai.shotbro.ru/p.jpg" } }],
    });
  });

  it("tts adapter validates input", () => {
    const adapter = new OpenRouterTtsAdapter(env);
    expect(() => adapter.validateRequest("openrouter/tts/auto", "TEXT_TO_SPEECH", {})).toThrow();
  });
});
