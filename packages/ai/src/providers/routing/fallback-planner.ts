import type { AppEnv } from "@shotbro/config/env";
import { isProviderLiveEligible } from "@shotbro/config/provider-policy";
import type { ProviderOperation } from "../capability-matrix.js";
import { buildRouteCandidate, listCompatibleFallbacks } from "./capability-resolver.js";
import { applyBudgetGuard } from "./budget-guard.js";
import { translateCanonicalToProvider } from "./parameter-translator.js";
import type { CanonicalSceneSettings, ProviderRoutePlan, RouteCandidate, SubmitFailureClass } from "./types.js";

const PRIMARY_BY_OPERATION: Partial<Record<ProviderOperation, { providerId: string; modelId: string }>> = {
  IMAGE_GENERATION: { providerId: "fal-flux", modelId: "fal-ai/flux/dev" },
  TEXT_TO_VIDEO: { providerId: "fal-minimax-video", modelId: "minimax/h3/text-to-video" },
  TEXT_TO_SPEECH: { providerId: "elevenlabs", modelId: "eleven_multilingual_v2" },
  IMAGE_UPSCALE: { providerId: "magnific", modelId: "magnific/image-upscaler-creative" },
};

const OPENROUTER_FALLBACK_BY_OPERATION: Partial<Record<ProviderOperation, { providerId: string; modelId: string }>> = {
  IMAGE_GENERATION: { providerId: "openrouter", modelId: "openrouter/image/auto" },
  TEXT_TO_VIDEO: { providerId: "openrouter", modelId: "openrouter/video/auto" },
  TEXT_TO_SPEECH: { providerId: "openrouter", modelId: "openrouter/tts/auto" },
};

export class ProviderFallbackPlanner {
  constructor(private readonly env: AppEnv) {}

  plan(
    settings: CanonicalSceneSettings,
    opts?: {
      primaryUnavailable?: boolean;
      failureClass?: SubmitFailureClass;
      providerRecovered?: boolean;
      existingAttemptCount?: number;
      fallbackEstimateUsd?: number;
    },
  ): ProviderRoutePlan {
    const events: ProviderRoutePlan["events"] = [];
    const operation = settings.operation;
    events.push({ type: "provider.route.planned", message: `Planning route for ${operation}` });

    if (opts?.failureClass === "POST_SUBMIT_AMBIGUOUS") {
      return {
        operation,
        primary: null,
        fallbacks: [],
        status: "NEEDS_RECONCILIATION",
        events: [...events, { type: "provider.reconciliation.required", message: "Ambiguous submit — no auto fallback" }],
        originalSettingsSnapshot: settings,
      };
    }

    if (opts?.providerRecovered && !opts.primaryUnavailable) {
      events.push({ type: "provider.route.planned", message: "Provider recovered — reuse primary route" });
    }

    const primaryDef =
      settings.primaryProviderId && settings.primaryModelId
        ? { providerId: settings.primaryProviderId, modelId: settings.primaryModelId }
        : PRIMARY_BY_OPERATION[operation];

    let primary = primaryDef ? buildRouteCandidate(primaryDef.providerId, primaryDef.modelId, operation, settings, this.env) : null;

    if (primary && !primary.compatible) {
      events.push({
        type: "provider.unavailable",
        message: primary.incompatibilityReasons?.join(", ") ?? "primary_incompatible",
      });
    }

    if (operation === "TEXT_TO_SPEECH" && settings.strictVoiceConsistency) {
      return {
        operation,
        primary,
        fallbacks: [],
        status: "FALLBACK_BLOCKED_VOICE",
        events: [...events, { type: "provider.fallback.blocked", message: "strictVoiceConsistency" }],
        originalSettingsSnapshot: settings,
      };
    }

    const fallbackMode = settings.fallbackMode ?? "automatic_compatible";
    const fallbacks: RouteCandidate[] = [];

    if (fallbackMode !== "disabled" && this.env.OPENROUTER_FALLBACK_ROUTING_ENABLED) {
      const fbDef = OPENROUTER_FALLBACK_BY_OPERATION[operation];
      if (fbDef) {
        const c = buildRouteCandidate(fbDef.providerId, fbDef.modelId, operation, settings, this.env);
        if (c.compatible) {
          if (opts?.fallbackEstimateUsd != null) {
            c.estimatedUsd = opts.fallbackEstimateUsd;
          }
          fallbacks.push(c);
          events.push({ type: "provider.fallback.proposed", message: `OpenRouter ${c.modelId}` });
        } else {
          events.push({ type: "provider.fallback.proposed", message: "OpenRouter fallback incompatible" });
        }
      }
      if (operation === "TEXT_TO_VIDEO" && settings.resolution) {
        const extras = listCompatibleFallbacks(operation, settings, this.env, "openrouter");
        for (const e of extras) {
          if (!fallbacks.some((f) => f.modelId === e.modelId)) fallbacks.push(e);
        }
      }
    }

    if (operation === "IMAGE_UPSCALE" && opts?.primaryUnavailable && fallbacks.length === 0) {
      return {
        operation,
        primary,
        fallbacks: [],
        status: "NO_COMPATIBLE_FALLBACK",
        events: [...events, { type: "provider.fallback.blocked", message: "No verified Magnific equivalent" }],
        originalSettingsSnapshot: settings,
      };
    }

    const primaryUsable = primary?.compatible && !opts?.primaryUnavailable;
    let status: ProviderRoutePlan["status"] = primaryUsable ? "PRIMARY_SELECTED" : "NO_COMPATIBLE_FALLBACK";
    let selected: RouteCandidate | undefined = primaryUsable ? primary ?? undefined : undefined;
    let fallbackReason: string | undefined;

    if (!primaryUsable && fallbacks[0]) {
      status = "FALLBACK_PLANNED";
      selected = fallbacks[0];
      fallbackReason = "primary_unavailable_pre_submit";
      events.push({ type: "provider.fallback.started", message: `Fallback ${fallbacks[0].providerId}` });
    }

    if (opts?.providerRecovered && primary?.compatible) {
      status = "PRIMARY_SELECTED";
      selected = primary;
      fallbackReason = undefined;
      events.push({ type: "provider.fallback.completed", message: "Primary restored — duplicate job prevented" });
    }

    let plan: ProviderRoutePlan = {
      operation,
      primary,
      fallbacks,
      selected,
      fallbackReason,
      status,
      events,
      originalSettingsSnapshot: settings,
      translatedSettingsSnapshot:
        selected && status === "FALLBACK_PLANNED"
          ? translateCanonicalToProvider(settings, selected.providerId, selected.modelId).supported
          : undefined,
      routePlanVersion: (opts?.existingAttemptCount ?? 0) + 1,
      duplicateJobPrevented: opts?.providerRecovered ? true : undefined,
    };

    if (selected?.priceStatus === "UNKNOWN" && isProviderLiveEligible(this.env, selected.providerId as never)) {
      plan = {
        ...plan,
        status: "PRICE_UNVERIFIED",
        events: [...plan.events, { type: "provider.pricing.unknown", message: "Live blocked until price verified" }],
      };
    }

    plan = applyBudgetGuard({ plan, settings, env: this.env, fallbackEstimateUsd: opts?.fallbackEstimateUsd });

    if (plan.status === "FALLBACK_PLANNED" && (opts?.existingAttemptCount ?? 0) > 0) {
      plan = {
        ...plan,
        fallbackReason: `${plan.fallbackReason ?? "fallback"}:attempt_${(opts?.existingAttemptCount ?? 0) + 1}`,
      };
    }

    return plan;
  }
}
