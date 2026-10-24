import { describe, expect, it } from "vitest";
import { MockHttpTransport } from "./http-transport.js";
import { FalFluxDevImageAdapter } from "./fal-flux-image-adapter.js";
import { ElevenLabsTtsAdapter } from "./elevenlabs-tts-adapter.js";
import { OpenRouterLlmAdapter } from "./openrouter-llm-adapter.js";

/** Phase 4E: vendor keys present must not imply network I/O when policy blocks. */
const blockedEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ENABLED: true,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
  OPENROUTER_API_KEY: "sk-or-v1-test-key-0123456789012345678901234567890",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  FAL_API_KEY: "fal-key-012345678901234567890",
  ELEVENLABS_API_KEY: "el-key-012345678901234567890",
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io",
} as import("@shotbro/config/env").AppEnv;

describe("Vendor adapters blocked combinations", () => {
  it("OpenRouter rejects when OPENROUTER_ENABLED but paid flag false", async () => {
    const adapter = new OpenRouterLlmAdapter(blockedEnv, new MockHttpTransport({}));
    await expect(
      adapter.complete({
        requestId: "r1",
        modelId: "test/model",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/blocked|not allowed|Paid|disabled/i);
  });

  it("Fal blocks despite FAL_API_KEY", async () => {
    const adapter = new FalFluxDevImageAdapter(blockedEnv, new MockHttpTransport({}));
    await expect(
      adapter.submit(FalFluxDevImageAdapter.modelId, "TEXT_TO_IMAGE", { prompt: "x" }, { idempotencyKey: "k" }),
    ).rejects.toThrow(/blocked/i);
  });

  it("ElevenLabs blocks despite API key", async () => {
    const adapter = new ElevenLabsTtsAdapter(blockedEnv, new MockHttpTransport({}));
    await expect(
      adapter.submit("eleven_multilingual_v2", "TEXT_TO_SPEECH", { text: "hi", voiceId: "v" }, {
        idempotencyKey: "k",
      }),
    ).rejects.toThrow(/blocked/i);
  });
});
