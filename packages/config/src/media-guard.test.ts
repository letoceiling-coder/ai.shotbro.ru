import { describe, expect, it } from "vitest";
import { assertMediaGenerationBlocked } from "./media-guard.js";
import { loadEnvFromProcess } from "./env.js";

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
    LLM_LIVE_EXECUTION_ENABLED: "false",
    MEDIA_GENERATION_ENABLED: "false",
    EMAIL_ENABLED: "false",
    ...overrides,
  });
}

describe("assertMediaGenerationBlocked (Phase 5K)", () => {
  it("blocks generate.image when MEDIA_GENERATION_ENABLED=false", () => {
    expect(() => assertMediaGenerationBlocked(testEnv(), "generate.image")).toThrow(/MEDIA_GENERATION_ENABLED=false/);
  });

  it("blocks generate.video when VIDEO flag off", () => {
    expect(() =>
      assertMediaGenerationBlocked(
        testEnv({ MEDIA_GENERATION_ENABLED: "true", VIDEO_GENERATION_ENABLED: "false" }),
        "generate.video",
      ),
    ).toThrow(/VIDEO_GENERATION_ENABLED=false/);
  });

  it("blocks when MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED=true even if media flags on", () => {
    expect(() =>
      assertMediaGenerationBlocked(
        testEnv({
          MEDIA_GENERATION_ENABLED: "true",
          IMAGE_GENERATION_ENABLED: "true",
          MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED: "true",
        }),
        "generate.image",
      ),
    ).toThrow(/MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED must stay false/);
  });

  it("allows non-media tools", () => {
    expect(() => assertMediaGenerationBlocked(testEnv(), "search_project_assets")).not.toThrow();
  });
});
