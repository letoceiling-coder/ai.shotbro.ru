import type { AppEnv } from "./env.js";
import { getAiExecutionConfig } from "./ai-execution.js";

export type ProviderId = "fal-flux" | "fal-minimax-video" | "elevenlabs" | "magnific" | "openrouter";

/** Live network I/O is never allowed under global mock/block flags, regardless of per-provider switches. */
export function isProviderConfigured(env: AppEnv, providerId: ProviderId): boolean {
  switch (providerId) {
    case "fal-flux":
    case "fal-minimax-video":
      return Boolean(env.FAL_API_KEY && env.FAL_API_KEY.length > 8);
    case "elevenlabs":
      return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY.length > 8);
    case "magnific":
      return Boolean(env.MAGNIFIC_API_KEY && env.MAGNIFIC_API_KEY.length > 8);
    case "openrouter":
      return Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.length > 8);
    default:
      return false;
  }
}

export function isProviderSwitchEnabled(env: AppEnv, providerId: ProviderId): boolean {
  switch (providerId) {
    case "fal-flux":
    case "fal-minimax-video":
      return env.FAL_PROVIDER_ENABLED;
    case "elevenlabs":
      return env.ELEVENLABS_PROVIDER_ENABLED;
    case "magnific":
      return env.MAGNIFIC_PROVIDER_ENABLED;
    case "openrouter":
      return env.OPENROUTER_ENABLED;
    default:
      return false;
  }
}

/** Would live execution be permitted for this provider if global gates were open? */
export function isProviderLiveEligible(env: AppEnv, providerId: ProviderId): boolean {
  const global = getAiExecutionConfig(env);
  if (global.mockMode || !global.liveProviderExecutionEnabled) return false;
  if (!isProviderSwitchEnabled(env, providerId)) return false;
  if (!isProviderConfigured(env, providerId)) return false;
  if (providerId === "openrouter" && !env.OPENROUTER_ALLOW_PAID_REQUESTS) {
    return false;
  }
  return true;
}

export function assertProviderLiveEligible(env: AppEnv, providerId: ProviderId): void {
  if (!isProviderLiveEligible(env, providerId)) {
    throw new Error(`Provider live execution blocked for ${providerId} (policy or configuration)`);
  }
}
