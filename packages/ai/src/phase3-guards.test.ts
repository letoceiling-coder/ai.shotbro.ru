import { describe, expect, it } from "vitest";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { assertExternalProviderExecutionAllowed } from "@shotbro/config";
import { assertProductionTransition } from "./state-machine.js";
import { buildMockBriefFromRequest, buildMockPlan, buildMockScript, buildMockStoryboard } from "./mock-intent.js";

function minimalEnv(overrides: Record<string, string> = {}) {
  return {
    S3_ENDPOINT: "https://example.invalid",
    S3_REGION: "ru-3",
    S3_BUCKET: "b",
    S3_ACCESS_KEY_ID: "12345678901234567890",
    S3_SECRET_ACCESS_KEY: "12345678901234567890",
    OPENROUTER_ENABLED: "false",
    OPENROUTER_ALLOW_PAID_REQUESTS: "false",
    AI_MOCK_MODE: "true",
    PROVIDER_LIVE_EXECUTION_ENABLED: "false",
    EMAIL_ENABLED: "false",
    ...overrides,
  };
}

describe("@shotbro/ai Phase 3 guards", () => {
  it("blocks EXTERNAL_PAID before any provider call", () => {
    const env = loadEnvFromProcess(minimalEnv({ OPENROUTER_API_KEY: "sk-or-v1-" + "x".repeat(40) }));
    expect(() => assertExternalProviderExecutionAllowed(env, "EXTERNAL_PAID")).toThrow(/blocked/i);
  });

  it("blocks EXTERNAL_FREE when AI_MOCK_MODE=true", () => {
    const env = loadEnvFromProcess(minimalEnv());
    expect(() => assertExternalProviderExecutionAllowed(env, "EXTERNAL_FREE")).toThrow(/AI_MOCK_MODE/i);
  });

  it("validates production state transitions", () => {
    assertProductionTransition("DRAFT", "BRIEFING");
    expect(() => assertProductionTransition("DRAFT", "PRODUCING")).toThrow(/Invalid/);
  });

  it("mock intent pipeline produces structured documents", () => {
    const brief = buildMockBriefFromRequest("Создай ролик 15 сек 9:16 для бренда Odezhda");
    expect(brief.durationSeconds).toBe(15);
    expect(brief.aspectRatio).toBe("9:16");
    expect(brief.mock).toBe(true);
    const plan = buildMockPlan(brief);
    const script = buildMockScript(brief, plan);
    expect(script.scenes.length).toBeGreaterThanOrEqual(3);
    const storyboard = buildMockStoryboard(script);
    expect(storyboard.frames.length).toBe(script.scenes.length);
  });
});
