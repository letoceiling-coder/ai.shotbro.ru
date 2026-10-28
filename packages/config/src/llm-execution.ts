import type { AppEnv } from "./env.js";
import { getOpenRouterConfig, assertOpenRouterRequestsAllowed } from "./openrouter.js";

export type CreativeLlmLimits = {
  maxIterations: number;
  maxToolCalls: number;
  maxOutputTokens: number;
  maxDurationMs: number;
  runMaxCostUsd: number;
};

export function getCreativeLlmLimits(env: AppEnv): CreativeLlmLimits {
  return {
    maxIterations: Number(process.env.CREATIVE_AGENT_MAX_ITERATIONS ?? 8),
    maxToolCalls: Number(process.env.CREATIVE_AGENT_MAX_TOOL_CALLS ?? 16),
    maxOutputTokens: Number(process.env.CREATIVE_AGENT_MAX_OUTPUT_TOKENS ?? 2048),
    maxDurationMs: Number(process.env.CREATIVE_AGENT_MAX_DURATION_MS ?? 120_000),
    runMaxCostUsd: Number(process.env.CREATIVE_AGENT_RUN_MAX_COST_USD ?? env.OPENROUTER_MAX_COST_USD ?? 0.25),
  };
}

export function isCreativeLlmLiveEnabled(env: AppEnv): boolean {
  return env.LLM_LIVE_EXECUTION_ENABLED === true && env.OPENROUTER_ENABLED === true;
}

/** Allows OpenRouter chat/completions for agent reasoning (not media providers). */
export function assertCreativeLlmNetworkAllowed(env: AppEnv): void {
  if (!env.LLM_LIVE_EXECUTION_ENABLED) {
    throw new Error("LLM live execution disabled (LLM_LIVE_EXECUTION_ENABLED=false)");
  }
  const cfg = getOpenRouterConfig(env);
  assertOpenRouterRequestsAllowed(cfg);
  if (!cfg.hasApiKey) {
    throw new Error("OpenRouter API key missing or invalid length");
  }
}
