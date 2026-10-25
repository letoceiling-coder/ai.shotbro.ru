import { describe, expect, it } from "vitest";
import { ProviderFallbackPlanner } from "./fallback-planner.js";
import type { CanonicalSceneSettings } from "./types.js";

const env = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_FALLBACK_ROUTING_ENABLED: true,
  OPENROUTER_API_KEY: "or-test-key-123456789",
  FAL_API_KEY: "fal-test-key-123456789",
  FAL_PROVIDER_ENABLED: false,
  ELEVENLABS_API_KEY: "x",
  ELEVENLABS_PROVIDER_ENABLED: false,
  MAGNIFIC_API_KEY: "x",
  MAGNIFIC_PROVIDER_ENABLED: false,
  OPENROUTER_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
} as import("@shotbro/config/env").AppEnv;

describe("provider financial invariants (planning)", () => {
  it("ambiguous submit never schedules fallback", () => {
    const plan = new ProviderFallbackPlanner(env).plan(
      { sceneId: "s", operation: "IMAGE_GENERATION", fallbackMode: "automatic_compatible" },
      { failureClass: "POST_SUBMIT_AMBIGUOUS" },
    );
    expect(plan.fallbacks).toHaveLength(0);
    expect(plan.status).toBe("NEEDS_RECONCILIATION");
  });

  it("re-approval when fallback estimate exceeds approved remainder", () => {
    const settings: CanonicalSceneSettings = {
      sceneId: "s",
      operation: "IMAGE_GENERATION",
      approvedMaxCostUsd: 1,
      consumedBudgetUsd: 0.9,
      reservedBudgetUsd: 0.05,
      fallbackMode: "automatic_compatible",
    };
    const plan = new ProviderFallbackPlanner(env).plan(settings, {
      primaryUnavailable: true,
      fallbackEstimateUsd: 0.2,
    });
    expect(plan.status).toBe("RE_APPROVAL_REQUIRED");
  });
});
