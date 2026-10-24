import { describe, expect, it } from "vitest";
import { MockHttpTransport } from "./http-transport.js";
import { ElevenLabsTtsAdapter } from "./elevenlabs-tts-adapter.js";

const env = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  ELEVENLABS_API_KEY: "el-test-key-12345678",
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io",
} as import("@shotbro/config/env").AppEnv;

describe("ElevenLabsTtsAdapter contract (mock transport)", () => {
  it("blocks when MOCK_ONLY", async () => {
    const adapter = new ElevenLabsTtsAdapter(env, new MockHttpTransport({}));
    await expect(
      adapter.submit("eleven_multilingual_v2", "TEXT_TO_SPEECH", { text: "hi", voiceId: "v1" }, {
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(/blocked|MOCK_ONLY/i);
  });

  it("maps invalid credentials", async () => {
    const liveEnv = { ...env, AI_MOCK_MODE: false, PROVIDER_LIVE_EXECUTION_ENABLED: true } as typeof env;
    const transport = new MockHttpTransport({
      "POST https://api.elevenlabs.io/v1/text-to-speech/v1": {
        status: 401,
        headers: {},
        body: { error: "invalid" },
      },
    });
    const adapter = new ElevenLabsTtsAdapter(liveEnv, transport);
    await expect(
      adapter.submit("eleven_multilingual_v2", "TEXT_TO_SPEECH", { text: "hi", voiceId: "v1" }, {
        idempotencyKey: "k2",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("maps audio success fixture", async () => {
    const liveEnv = { ...env, AI_MOCK_MODE: false, PROVIDER_LIVE_EXECUTION_ENABLED: true } as typeof env;
    const transport = new MockHttpTransport({
      "POST https://api.elevenlabs.io/v1/text-to-speech/voice-a": {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
        body: { __audio: true },
      },
    });
    const adapter = new ElevenLabsTtsAdapter(liveEnv, transport);
    const result = await adapter.submit(
      "eleven_multilingual_v2",
      "TEXT_TO_SPEECH",
      { text: "hello", voiceId: "voice-a" },
      { idempotencyKey: "k3" },
    );
    expect(result.status).toBe("COMPLETED");
  });
});
