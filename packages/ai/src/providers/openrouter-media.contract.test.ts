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

  it("tts adapter validates input", () => {
    const adapter = new OpenRouterTtsAdapter(env);
    expect(() => adapter.validateRequest("openrouter/tts/auto", "TEXT_TO_SPEECH", {})).toThrow();
  });
});
