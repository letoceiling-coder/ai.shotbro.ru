import { describe, expect, it } from "vitest";
import { loadEnvFromProcess } from "./env.js";
import { assertLiveMediaStartupPolicy, evaluateLiveMediaPolicy } from "./live-media-policy.js";

function testEnv(overrides: Record<string, string> = {}) {
  return loadEnvFromProcess({
    S3_ENDPOINT: "http://127.0.0.1:9000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "test",
    S3_ACCESS_KEY_ID: "12345678901234567890",
    S3_SECRET_ACCESS_KEY: "12345678901234567890",
    OPENROUTER_ENABLED: "false",
    OPENROUTER_ALLOW_PAID_REQUESTS: "false",
    AI_MOCK_MODE: "true",
    PROVIDER_LIVE_EXECUTION_ENABLED: "false",
    EMAIL_ENABLED: "false",
    ...overrides,
  });
}

const liveFlags = { AI_MOCK_MODE: "false", PROVIDER_LIVE_EXECUTION_ENABLED: "true" };

describe("live media policy (Phase 6B)", () => {
  it("staging defaults: nothing requested, startup ok", () => {
    const env = testEnv();
    expect(evaluateLiveMediaPolicy(env).liveMediaRequested).toBe(false);
    expect(() => assertLiveMediaStartupPolicy(env)).not.toThrow();
  });

  it("OpenRouter LLM alone no longer trips the media guard", () => {
    const env = testEnv({ OPENROUTER_ENABLED: "true", OPENROUTER_API_KEY: "or-key-1234567890", LLM_LIVE_EXECUTION_ENABLED: "true" });
    expect(() => assertLiveMediaStartupPolicy(env)).not.toThrow();
  });

  it("voice cloning switch in mock mode fails fast at startup", () => {
    const env = testEnv({ VOICE_CLONING_ENABLED: "true" });
    expect(() => assertLiveMediaStartupPolicy(env)).toThrow(/AI_MOCK_MODE=true/);
  });

  it("image/video generation stays blocked even with live flags (enforcement in 6E)", () => {
    const env = testEnv({ ...liveFlags, MEDIA_GENERATION_ENABLED: "true" });
    const p = evaluateLiveMediaPolicy(env, "generation");
    expect(p.liveMediaAllowed).toBe(false);
    expect(p.reasons.join(" ")).toMatch(/Phase 6E/);
    expect(() => assertLiveMediaStartupPolicy(env)).toThrow(/generation/);
  });

  it("talent scope is allowed when live flags and caps are valid (approval enforced in 6C)", () => {
    const env = testEnv({ ...liveFlags, ELEVENLABS_PROVIDER_ENABLED: "true", VOICE_CLONING_ENABLED: "true" });
    expect(evaluateLiveMediaPolicy(env, "talent")).toMatchObject({ liveMediaAllowed: true, reasons: [] });
    expect(() => assertLiveMediaStartupPolicy(env)).not.toThrow();
  });

  it("rejects caps above hard ceilings or run cap above daily cap", () => {
    const env = testEnv({ ...liveFlags, MEDIA_GENERATION_ENABLED: "true", MEDIA_RUN_MAX_COST_USD: "50", MEDIA_USER_DAILY_MAX_USD: "10" });
    const reasons = evaluateLiveMediaPolicy(env, "generation").reasons.join(" ");
    expect(reasons).toMatch(/MEDIA_RUN_MAX_COST_USD must be in/);
    expect(reasons).toMatch(/must not exceed/);
  });

  it("minimal customer caps are the defaults (1 / 3 USD)", () => {
    const env = testEnv();
    expect(env.MEDIA_RUN_MAX_COST_USD).toBe(1);
    expect(env.MEDIA_USER_DAILY_MAX_USD).toBe(3);
  });
});
