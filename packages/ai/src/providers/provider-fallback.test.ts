import { describe, expect, it } from "vitest";
import { ProviderFallbackPlanner } from "./routing/fallback-planner.js";
import type { CanonicalSceneSettings } from "./routing/types.js";

const baseEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
  OPENROUTER_FALLBACK_ROUTING_ENABLED: true,
  OPENROUTER_API_KEY: "or-test-key-123456789",
  FAL_API_KEY: "fal-test-key-123456789",
  FAL_PROVIDER_ENABLED: false,
  ELEVENLABS_API_KEY: "el-test-key-123456789",
  ELEVENLABS_PROVIDER_ENABLED: false,
  MAGNIFIC_API_KEY: "mag-test-key-123456789",
  MAGNIFIC_PROVIDER_ENABLED: false,
} as import("@shotbro/config/env").AppEnv;

function scene(partial: Partial<CanonicalSceneSettings>): CanonicalSceneSettings {
  return {
    sceneId: "s1",
    operation: "IMAGE_GENERATION",
    aspectRatio: "9:16",
    fallbackMode: "automatic_compatible",
    ...partial,
  };
}

describe("ProviderFallbackPlanner (mock routing)", () => {
  it("A: Fal available → primary selected", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(scene({ operation: "IMAGE_GENERATION" }));
    expect(plan.status).toBe("PRIMARY_SELECTED");
    expect(plan.selected?.providerId).toBe("fal-flux");
  });

  it("B: Fal rejected pre-submit → OpenRouter image fallback", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(
      scene({ operation: "IMAGE_GENERATION" }),
      { primaryUnavailable: true, failureClass: "PRE_SUBMIT_FAILURE" },
    );
    expect(plan.status).toBe("FALLBACK_PLANNED");
    expect(plan.selected?.providerId).toBe("openrouter");
  });

  it("C: video resolution mismatch → compatible OpenRouter video", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(
      scene({ operation: "TEXT_TO_VIDEO", resolution: "2160p" }),
    );
    expect(plan.status).toBe("FALLBACK_PLANNED");
    expect(plan.selected?.providerId).toBe("openrouter");
  });

  it("D: ElevenLabs unavailable → OpenRouter TTS", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(
      scene({ operation: "TEXT_TO_SPEECH" }),
      { primaryUnavailable: true },
    );
    expect(plan.status).toBe("FALLBACK_PLANNED");
    expect(plan.selected?.providerId).toBe("openrouter");
  });

  it("E: strict voice → fallback blocked", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(
      scene({ operation: "TEXT_TO_SPEECH", strictVoiceConsistency: true }),
      { primaryUnavailable: true },
    );
    expect(plan.status).toBe("FALLBACK_BLOCKED_VOICE");
  });

  it("F: Magnific unavailable → no upscale equivalent", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(
      scene({ operation: "IMAGE_UPSCALE" }),
      { primaryUnavailable: true },
    );
    expect(plan.status).toBe("NO_COMPATIBLE_FALLBACK");
  });

  it("G: unknown pricing blocks live-eligible route", () => {
    const liveEnv = {
      ...baseEnv,
      AI_MOCK_MODE: false,
      PROVIDER_LIVE_EXECUTION_ENABLED: true,
      FAL_PROVIDER_ENABLED: true,
      OPENROUTER_ENABLED: true,
      OPENROUTER_ALLOW_PAID_REQUESTS: true,
    } as import("@shotbro/config/env").AppEnv;
    const plan = new ProviderFallbackPlanner(liveEnv).plan(scene({ operation: "IMAGE_GENERATION" }));
    expect(plan.status).toBe("PRICE_UNVERIFIED");
  });

  it("H: fallback over budget → re-approval", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(
      scene({ operation: "IMAGE_GENERATION", approvedMaxCostUsd: 0.01 }),
      { primaryUnavailable: true, fallbackEstimateUsd: 5 },
    );
    expect(plan.status).toBe("RE_APPROVAL_REQUIRED");
  });

  it("I: ambiguous submit → reconciliation", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(scene({}), {
      failureClass: "POST_SUBMIT_AMBIGUOUS",
    });
    expect(plan.status).toBe("NEEDS_RECONCILIATION");
  });

  it("J: provider recovery → primary without duplicate job flag", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(scene({ operation: "IMAGE_GENERATION" }), {
      providerRecovered: true,
      existingAttemptCount: 1,
    });
    expect(plan.status).toBe("PRIMARY_SELECTED");
    expect(plan.duplicateJobPrevented).toBe(true);
  });
});
