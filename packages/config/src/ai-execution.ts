import type { AppEnv } from "./env.js";

export type AiExecutionConfig = {
  mockMode: boolean;
  liveProviderExecutionEnabled: boolean;
};

export function getAiExecutionConfig(env: AppEnv): AiExecutionConfig {
  return {
    mockMode: env.AI_MOCK_MODE,
    liveProviderExecutionEnabled: env.PROVIDER_LIVE_EXECUTION_ENABLED,
  };
}

/** Block any paid or live external provider call (Phase 3 default). */
export function assertExternalProviderExecutionAllowed(
  env: AppEnv,
  sideEffect: "EXTERNAL_FREE" | "EXTERNAL_PAID",
): void {
  const cfg = getAiExecutionConfig(env);
  if (sideEffect === "EXTERNAL_PAID") {
    if (cfg.mockMode || !cfg.liveProviderExecutionEnabled) {
      throw new Error(
        "EXTERNAL_PAID execution blocked (AI_MOCK_MODE or PROVIDER_LIVE_EXECUTION_ENABLED=false)",
      );
    }
    if (env.OPENROUTER_ALLOW_PAID_REQUESTS) {
      throw new Error("OPENROUTER_ALLOW_PAID_REQUESTS must stay false in Phase 3");
    }
  }
  if (sideEffect === "EXTERNAL_FREE" && cfg.mockMode) {
    throw new Error("External provider calls blocked while AI_MOCK_MODE=true");
  }
}
