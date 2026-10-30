import type { AppEnv } from "./env.js";

/**
 * Phase 6: live paid media is allowed only where the server itself enforces
 * "approved cost ⇒ execution". Scopes ship separately:
 * - talent (voice design/clone/save, avatar training): enforced since Phase 6C
 *   (quote → approval → reservation → job, re-checked in the worker);
 * - generation (legacy media tools generate.image/video): stays blocked;
 * - canvas (scene-canvas nodes): enforced since Phase 6E (quote → approval → payload re-check → jobs,
 *   re-checked in the worker per node); live adapters wired in 6G behind CANVAS_LIVE_GENERATION_ENABLED.
 */
export const LIVE_MEDIA_APPROVAL_ENFORCED = { talent: true, generation: false, canvas: true } as const;

export type LiveMediaScope = keyof typeof LIVE_MEDIA_APPROVAL_ENFORCED;

/** Hard ceilings: env caps above these are treated as misconfiguration. */
export const LIVE_MEDIA_HARD_MAX_RUN_USD = 20;
export const LIVE_MEDIA_HARD_MAX_DAILY_USD = 100;

export type LiveMediaPolicy = {
  scope: LiveMediaScope;
  liveMediaRequested: boolean;
  liveMediaAllowed: boolean;
  reasons: string[];
};

function requested(env: AppEnv, scope: LiveMediaScope) {
  if (scope === "talent") {
    return env.VOICE_CLONING_ENABLED || env.AVATAR_GENERATION_ENABLED || env.ELEVENLABS_PROVIDER_ENABLED || env.HEYGEN_PROVIDER_ENABLED;
  }
  if (scope === "canvas") return env.CANVAS_LIVE_GENERATION_ENABLED;
  return env.MEDIA_GENERATION_ENABLED || env.MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED;
}

/** Pure evaluation (used by API startup, worker, and the capability manifest). */
export function evaluateLiveMediaPolicy(env: AppEnv, scope: LiveMediaScope = "talent"): LiveMediaPolicy {
  const liveMediaRequested = requested(env, scope);
  const reasons: string[] = [];
  if (!liveMediaRequested) {
    return { scope, liveMediaRequested, liveMediaAllowed: false, reasons: [`live ${scope} switches are off`] };
  }
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
  if (!LIVE_MEDIA_APPROVAL_ENFORCED[scope]) {
    reasons.push(`server-side approval enforcement for ${scope} not shipped`);
  }
  return { scope, liveMediaRequested, liveMediaAllowed: reasons.length === 0, reasons };
}

/** Startup guard: replaces the Phase 5K "OpenRouter + media" blanket ban with explicit per-scope rules. */
export function assertLiveMediaStartupPolicy(env: AppEnv): void {
  for (const scope of ["talent", "generation", "canvas"] as const) {
    const p = evaluateLiveMediaPolicy(env, scope);
    if (p.liveMediaRequested && !p.liveMediaAllowed) {
      throw new Error(`Live ${scope} switches are on but blocked: ${p.reasons.join("; ")}`);
    }
  }
}
