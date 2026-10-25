import type { AppEnv } from "@shotbro/config/env";
import { isProviderConfigured } from "@shotbro/config/provider-policy";
import { findCapability, listCapabilities, type ProviderOperation } from "../capability-matrix.js";
import type { CanonicalSceneSettings, RouteCandidate } from "./types.js";
import { translateCanonicalToProvider } from "./parameter-translator.js";

const MAX_VIDEO_HEIGHT: Record<string, number> = {
  "fal-minimax-video": 1080,
  "openrouter": 2160,
};

function parseMaxHeight(resolution?: string): number | null {
  if (!resolution) return null;
  const m = resolution.match(/(\d{3,4})p/i);
  if (m) return Number(m[1]);
  const wh = resolution.match(/x(\d+)/i);
  if (wh) return Number(wh[1]);
  return null;
}

export function providerSupportsResolution(providerId: string, operation: ProviderOperation, resolution?: string): boolean {
  const h = parseMaxHeight(resolution);
  if (!h) return true;
  if (operation !== "TEXT_TO_VIDEO" && operation !== "IMAGE_TO_VIDEO") return true;
  const max = MAX_VIDEO_HEIGHT[providerId] ?? MAX_VIDEO_HEIGHT[providerId.split("-")[0] ?? ""] ?? 4320;
  return h <= max;
}

export function buildRouteCandidate(
  providerId: string,
  modelId: string,
  operation: ProviderOperation,
  settings: CanonicalSceneSettings,
  env: AppEnv,
): RouteCandidate {
  const cap = findCapability(providerId, modelId, operation);
  const translation = translateCanonicalToProvider(settings, providerId, modelId);
  const reasons: string[] = [...translation.rejected];
  if (!cap) reasons.push("unknown_capability");
  if (!isProviderConfigured(env, providerId as never)) reasons.push("provider_not_configured");
  if (!providerSupportsResolution(providerId, operation, settings.resolution)) {
    reasons.push("resolution_not_supported");
  }
  const compatible = reasons.length === 0;
  return {
    providerId,
    modelId,
    operation,
    priceStatus: cap?.priceStatus ?? "UNKNOWN",
    compatible,
    incompatibilityReasons: reasons.length ? reasons : undefined,
  };
}

export function listCompatibleFallbacks(
  operation: ProviderOperation,
  settings: CanonicalSceneSettings,
  env: AppEnv,
  providerFilter?: string,
): RouteCandidate[] {
  return listCapabilities({ operation, providerId: providerFilter })
    .filter((c) => c.providerId !== settings.primaryProviderId)
    .map((c) => buildRouteCandidate(c.providerId, c.modelId, operation, settings, env))
    .filter((c) => c.compatible);
}
