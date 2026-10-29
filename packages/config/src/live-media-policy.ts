import type { AppEnv } from "./env.js";

/**
 * Phase 6: live paid media (voices, avatars, images, video) is allowed only when the server itself
 * enforces "approved cost ⇒ execution". That enforcement lands in Phase 6C; until then this stays
 * false and any attempt to switch live media on fails fast at startup.
 */
export const LIVE_MEDIA_APPROVAL_ENFORCED = false;

/** Hard ceilings: env caps above these are treated as misconfiguration. */
export const LIVE_MEDIA_HARD_MAX_RUN_USD = 20;
export const LIVE_MEDIA_HARD_MAX_DAILY_USD = 100;

export type LiveMediaPolicy = {
  liveMediaRequested: boolean;
  liveMediaAllowed: boolean;
  reasons: string[];
};

function wantsLiveMedia(env: AppEnv) {
  return (
    env.MEDIA_GENERATION_ENABLED ||
    env.MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED ||
    env.VOICE_CLONING_ENABLED ||
    env.AVATAR_GENERATION_ENABLED
  );
}

/** Pure evaluation (used by API startup, worker, and the capability manifest). */
export function evaluateLiveMediaPolicy(env: AppEnv): LiveMediaPolicy {
  const liveMediaRequested = wantsLiveMedia(env);
  const reasons: string[] = [];
  if (!liveMediaRequested) return { liveMediaRequested, liveMediaAllowed: false, reasons: ["live media switches are off"] };
  if (env.AI_MOCK_MODE) reasons.push("AI_MOCK_MODE=true");
  if (!env.PROVIDER_LIVE_EXECUTION_ENABLED) reasons.push("PROVIDER_LIVE_EXECUTION_ENABLED=false");
  if (!(env.MEDIA_RUN_MAX_COST_USD > 0) || env.MEDIA_RUN_MAX_COST_USD > LIVE_MEDIA_HARD_MAX_RUN_USD) {
    reasons.push(`MEDIA_RUN_MAX_COST_USD must be in (0, ${LIVE_MEDIA_HARD_MAX_RUN_USD}]`);
  }
  if (!(env.MEDIA_USER_DAILY_MAX_USD > 0) || env.MEDIA_USER_DAILY_MAX_USD > LIVE_MEDIA_HARD_MAX_DAILY_USD) {
    reasons.push(`MEDIA_USER_DAILY_MAX_USD must be in (0, ${LIVE_MEDIA_HARD_MAX_DAILY_USD}]`);
  }
  if (env.MEDIA_RUN_MAX_COST_USD > env.MEDIA_USER_DAILY_MAX_USD) {
    reasons.push("MEDIA_RUN_MAX_COST_USD must not exceed MEDIA_USER_DAILY_MAX_USD");
  }
  if (!LIVE_MEDIA_APPROVAL_ENFORCED) reasons.push("server-side approval enforcement not shipped yet (Phase 6C)");
  return { liveMediaRequested, liveMediaAllowed: reasons.length === 0, reasons };
}

/** Startup guard: replaces the Phase 5K "OpenRouter + media" blanket ban with explicit rules. */
export function assertLiveMediaStartupPolicy(env: AppEnv): void {
  const p = evaluateLiveMediaPolicy(env);
  if (p.liveMediaRequested && !p.liveMediaAllowed) {
    throw new Error(`Live media switches are on but blocked: ${p.reasons.join("; ")}`);
  }
}
