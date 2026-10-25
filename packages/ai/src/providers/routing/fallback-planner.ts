import type { AppEnv } from "@shotbro/config/env";
import { isProviderConfigured, isProviderLiveEligible } from "@shotbro/config/provider-policy";
import { listCapabilities, type ProviderOperation } from "../capability-matrix.js";
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

function candidateFrom(
  providerId: string,
  modelId: string,
  operation: ProviderOperation,
  settings: CanonicalSceneSettings,
): RouteCandidate {
  const cap = listCapabilities({ providerId, operation }).find((c) => c.modelId === modelId);
  const translation = translateCanonicalToProvider(settings, providerId, modelId);
  const compatible = translation.rejected.length === 0 && Boolean(cap);
  return {
    providerId,
    modelId,
    operation,
    priceStatus: cap?.priceStatus ?? "UNKNOWN",
    compatible,
    incompatibilityReasons: translation.rejected.length ? translation.rejected : undefined,
  };
}

export class ProviderFallbackPlanner {
  constructor(private readonly env: AppEnv) {}

  plan(settings: CanonicalSceneSettings, opts?: { primaryUnavailable?: boolean; failureClass?: SubmitFailureClass }) {
    const events: ProviderRoutePlan["events"] = [];
    const operation = settings.operation;
    events.push({ type: "provider.route.planned", message: `Planning route for ${operation}` });

    const primaryDef =
      settings.primaryProviderId && settings.primaryModelId
        ? { providerId: settings.primaryProviderId, modelId: settings.primaryModelId }
        : PRIMARY_BY_OPERATION[operation];

    let primary = primaryDef ? candidateFrom(primaryDef.providerId, primaryDef.modelId, operation, settings) : null;

    if (primary && !isProviderConfigured(this.env, primary.providerId as never)) {
      events.push({ type: "provider.unavailable", message: `${primary.providerId} not configured` });
      primary = { ...primary, compatible: false, incompatibilityReasons: ["provider_not_configured"] };
    }

    if (opts?.failureClass === "POST_SUBMIT_AMBIGUOUS") {
      return {
        operation,
        primary,
        fallbacks: [],
        status: "NEEDS_RECONCILIATION",
        events: [...events, { type: "provider.reconciliation.required", message: "Ambiguous submit — no auto fallback" }],
        originalSettingsSnapshot: settings,
      } satisfies ProviderRoutePlan;
    }

    const fallbackMode = settings.fallbackMode ?? "automatic_compatible";
    const fallbacks: RouteCandidate[] = [];

    if (fallbackMode !== "disabled" && this.env.OPENROUTER_FALLBACK_ROUTING_ENABLED) {
      const fb = OPENROUTER_FALLBACK_BY_OPERATION[operation];
      if (fb) {
        const c = candidateFrom(fb.providerId, fb.modelId, operation, settings);
        if (c.compatible) fallbacks.push(c);
        else events.push({ type: "provider.fallback.proposed", message: "OpenRouter fallback incompatible" });
      }
    }

    if (operation === "TEXT_TO_SPEECH" && settings.strictVoiceConsistency) {
      return {
        operation,
        primary,
        fallbacks: [],
        status: "FALLBACK_BLOCKED_VOICE",
        events: [...events, { type: "provider.fallback.blocked", message: "strictVoiceConsistency" }],
        originalSettingsSnapshot: settings,
      } satisfies ProviderRoutePlan;
    }

    if (operation === "IMAGE_UPSCALE" && opts?.primaryUnavailable && fallbacks.length === 0) {
      return {
        operation,
        primary,
        fallbacks: [],
        status: "NO_COMPATIBLE_FALLBACK",
        events: [...events, { type: "provider.fallback.blocked", message: "No verified Magnific equivalent" }],
        originalSettingsSnapshot: settings,
      } satisfies ProviderRoutePlan;
    }

    const selected = opts?.primaryUnavailable && fallbacks[0] ? fallbacks[0] : primary;
    if (selected?.priceStatus === "UNKNOWN" && isProviderLiveEligible(this.env, selected.providerId as never)) {
      return {
        operation,
        primary,
        fallbacks,
        selected,
        status: "PRICING_BLOCKED",
        events: [...events, { type: "provider.pricing.unknown", message: "Live blocked until price verified" }],
        originalSettingsSnapshot: settings,
      } satisfies ProviderRoutePlan;
    }

    const fbCost = fallbacks[0]?.estimatedUsd ?? 0;
    const approved = settings.approvedMaxCostUsd ?? 0;
    if (opts?.primaryUnavailable && fallbacks[0] && approved > 0 && fbCost > approved) {
      return {
        operation,
        primary,
        fallbacks,
        selected: fallbacks[0],
        status: "RE_APPROVAL_REQUIRED",
        events: [...events, { type: "provider.fallback.approval", message: "Fallback exceeds approved budget" }],
        originalSettingsSnapshot: settings,
      } satisfies ProviderRoutePlan;
    }

    if (opts?.primaryUnavailable && fallbacks[0]) {
      events.push({ type: "provider.fallback.started", message: `Fallback ${fallbacks[0].providerId}` });
      return {
        operation,
        primary,
        fallbacks,
        selected: fallbacks[0],
        fallbackReason: "primary_unavailable_pre_submit",
        status: "FALLBACK_PLANNED",
        events,
        originalSettingsSnapshot: settings,
        translatedSettingsSnapshot: translateCanonicalToProvider(settings, fallbacks[0].providerId, fallbacks[0].modelId)
          .supported,
      } satisfies ProviderRoutePlan;
    }

    return {
      operation,
      primary,
      fallbacks,
      selected: primary ?? undefined,
      status: primary ? "PRIMARY_SELECTED" : "NO_COMPATIBLE_FALLBACK",
      events,
      originalSettingsSnapshot: settings,
    } satisfies ProviderRoutePlan;
  }
}
