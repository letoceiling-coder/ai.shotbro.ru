import type { AppEnv } from "@shotbro/config/env";
import { getElevenLabsConfig, getFalConfig, getHeyGenConfig } from "@shotbro/config/vendor-providers";
import type { AvatarProvider, MediaCapability, ProviderChain, ProviderChoice } from "@shotbro/contracts";

/**
 * Customer priority (2026-10-30): HeyGen → Fal → OpenRouter.
 * Availability = key present + vendor switch on. Live network calls are still gated separately by
 * ExecutionPolicyEngine; in mock mode the chain only tells the user/agent which route would be used.
 */
const ORDER: AvatarProvider[] = ["heygen", "fal", "openrouter"];

function vendorState(env: AppEnv, providerId: AvatarProvider): { configured: boolean; reason: string } {
  if (providerId === "heygen") {
    if (!getHeyGenConfig(env).hasApiKey) return { configured: false, reason: "Нет ключа HEYGEN_API_KEY" };
    if (!env.HEYGEN_PROVIDER_ENABLED) return { configured: false, reason: "HeyGen выключен (HEYGEN_PROVIDER_ENABLED=false)" };
    return { configured: true, reason: "HeyGen подключён" };
  }
  if (providerId === "fal") {
    if (!getFalConfig(env).hasApiKey) return { configured: false, reason: "Нет ключа FAL_API_KEY" };
    if (!env.FAL_PROVIDER_ENABLED) return { configured: false, reason: "Fal выключен (FAL_PROVIDER_ENABLED=false)" };
    return { configured: true, reason: "Fal подключён" };
  }
  if (!env.OPENROUTER_API_KEY) return { configured: false, reason: "Нет ключа OPENROUTER_API_KEY" };
  if (!env.OPENROUTER_ENABLED) return { configured: false, reason: "OpenRouter выключен (OPENROUTER_ENABLED=false)" };
  return { configured: true, reason: "OpenRouter подключён (видео через /videos)" };
}

function supports(capability: MediaCapability, providerId: AvatarProvider): { ok: boolean; reason?: string } {
  if (capability === "SCENE_VIDEO" && providerId === "heygen") {
    return { ok: false, reason: "Прямой API HeyGen — только аватарные ролики; сцены идут через Fal или OpenRouter" };
  }
  return { ok: true };
}

/** HeyGen keeps a trained photo avatar (stable face). Fal/OpenRouter only use photos as references. */
function persistentIdentity(capability: MediaCapability, providerId: AvatarProvider) {
  return providerId === "heygen" && capability !== "SCENE_VIDEO";
}

export function resolveMediaProviderChain(env: AppEnv, capability: MediaCapability): ProviderChain {
  const chain: ProviderChoice[] = ORDER.map((providerId) => {
    const support = supports(capability, providerId);
    const state = vendorState(env, providerId);
    const available = support.ok && state.configured;
    return {
      providerId,
      available,
      reason: support.ok ? state.reason : support.reason!,
      persistentIdentity: persistentIdentity(capability, providerId),
    };
  });
  const selected = chain.find((c) => c.available)?.providerId ?? null;
  return { capability, selected, chain, mockMode: env.AI_MOCK_MODE };
}

/** ElevenLabs is the only voice vendor; cloning additionally needs the feature switch. */
export function resolveVoiceVendorState(env: AppEnv) {
  const cfg = getElevenLabsConfig(env);
  return {
    hasApiKey: cfg.hasApiKey,
    vendorEnabled: env.ELEVENLABS_PROVIDER_ENABLED,
    cloningEnabled: env.VOICE_CLONING_ENABLED,
    mockMode: env.AI_MOCK_MODE,
  };
}
