import type { AppEnv } from "./env.js";

export type QualityStrategy = "economy" | "balance" | "quality";

export type OpenRouterServerConfig = {
  enabled: boolean;
  allowPaidRequests: boolean;
  baseUrl: string;
  defaultModel: string | undefined;
  maxCostUsd: number;
  /** Key present on server only — never expose to clients or logs */
  hasApiKey: boolean;
  defaultQualityStrategy: QualityStrategy;
  /** Phase 3: allowlist of model slugs */
  modelAllowlist: string[];
  /** Phase 3: prompt caching preference */
  promptCachingEnabled: boolean;
  /** Phase 3: per-user daily cap */
  userDailyMaxUsd: number;
};

export function getOpenRouterConfig(env: AppEnv): OpenRouterServerConfig {
  const allowlistRaw = process.env.OPENROUTER_MODEL_ALLOWLIST;
  const modelAllowlist = allowlistRaw
    ? allowlistRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const strategy = (process.env.OPENROUTER_DEFAULT_QUALITY_STRATEGY ?? "balance") as QualityStrategy;

  return {
    enabled: env.OPENROUTER_ENABLED,
    allowPaidRequests: env.OPENROUTER_ALLOW_PAID_REQUESTS,
    baseUrl: env.OPENROUTER_BASE_URL,
    defaultModel: env.OPENROUTER_DEFAULT_MODEL,
    maxCostUsd: env.OPENROUTER_MAX_COST_USD,
    hasApiKey: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.length > 20),
    defaultQualityStrategy: strategy === "economy" || strategy === "quality" ? strategy : "balance",
    modelAllowlist,
    promptCachingEnabled: process.env.OPENROUTER_PROMPT_CACHING === "true",
    userDailyMaxUsd: Number(process.env.OPENROUTER_USER_DAILY_MAX_USD ?? 0),
  };
}

/** Phase 2 guard — throws if a caller attempts a network request while disabled */
export function assertOpenRouterRequestsAllowed(config: OpenRouterServerConfig): void {
  if (!config.enabled) {
    throw new Error("OpenRouter is disabled (OPENROUTER_ENABLED=false)");
  }
  if (config.allowPaidRequests) {
    throw new Error("Paid OpenRouter requests are not allowed in this phase");
  }
}

/** Offline validation only — no HTTP */
export function validateOpenRouterKeyPresent(apiKey: string | undefined): { ok: boolean; detail: string } {
  if (!apiKey) return { ok: false, detail: "OPENROUTER_API_KEY not set" };
  if (!apiKey.startsWith("sk-or-v1-")) return { ok: false, detail: "OPENROUTER_API_KEY format invalid" };
  if (apiKey.length < 40) return { ok: false, detail: "OPENROUTER_API_KEY too short" };
  return { ok: true, detail: "OPENROUTER_API_KEY present (value not logged)" };
}
