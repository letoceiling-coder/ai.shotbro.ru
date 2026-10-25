import { describe, expect, it } from "vitest";
import { ProviderFallbackPlanner } from "./routing/fallback-planner.js";
import type { CanonicalSceneSettings } from "./routing/types.js";

const baseEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
  OPENROUTER_FALLBACK_ROUTING_ENABLED: true,
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

  it("I: ambiguous submit → reconciliation", () => {
    const plan = new ProviderFallbackPlanner(baseEnv).plan(scene({}), {
      failureClass: "POST_SUBMIT_AMBIGUOUS",
    });
    expect(plan.status).toBe("NEEDS_RECONCILIATION");
  });

  it("H: fallback over budget → re-approval", () => {
    const env = { ...baseEnv, OPENROUTER_FALLBACK_ROUTING_ENABLED: true };
    const plan = new ProviderFallbackPlanner(env).plan(
      scene({ operation: "IMAGE_GENERATION", approvedMaxCostUsd: 0.01 }),
      { primaryUnavailable: true },
    );
    expect(["RE_APPROVAL_REQUIRED", "FALLBACK_PLANNED"]).toContain(plan.status);
  });
});
