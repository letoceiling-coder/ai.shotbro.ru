import type { AppEnv } from "@shotbro/config/env";
import { evaluateLiveMediaPolicy } from "@shotbro/config/live-media-policy";
import { getElevenLabsConfig } from "@shotbro/config/vendor-providers";
import type { RunnableCanvasKind } from "@shotbro/contracts";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import { resolveMediaProviderChain } from "../providers/media-provider-chain.js";

/**
 * Phase 6G: why a canvas node may not run live. Empty list ⇒ allowed.
 * Checked by the API before creating jobs and again by the worker before each network call.
 * Live canvas routes wired in 6G: images/video/avatar video via OpenRouter, TTS via ElevenLabs.
 */
export function liveCanvasBlockers(env: AppEnv, kind: RunnableCanvasKind): string[] {
  const reasons: string[] = [];
  if (kind === "assembly") return reasons; // local ffmpeg, no provider
  if (new ExecutionPolicyEngine(env).resolveMode() !== "LIVE_APPROVED") reasons.push("execution mode is not LIVE_APPROVED");
  const policy = evaluateLiveMediaPolicy(env, "canvas");
  if (!policy.liveMediaAllowed) reasons.push(...policy.reasons);

  const openRouterReady = () => {
    if (!env.OPENROUTER_ENABLED) reasons.push("OPENROUTER_ENABLED=false");
    if (!env.OPENROUTER_API_KEY) reasons.push("OPENROUTER_API_KEY missing");
  };
  if (kind === "first_frame") openRouterReady();
  if (kind === "scene_video" || kind === "avatar_video") {
    const chain = resolveMediaProviderChain(env, kind === "scene_video" ? "SCENE_VIDEO" : "AVATAR_VIDEO");
    // Customer order HeyGen → Fal → OpenRouter: only the OpenRouter route is wired for canvas nodes.
    if (chain.selected && chain.selected !== "openrouter") {
      reasons.push(`provider ${chain.selected} selected by chain, canvas route not wired yet`);
    }
    openRouterReady();
  }
  if (kind === "tts") {
    if (!env.ELEVENLABS_PROVIDER_ENABLED) reasons.push("ELEVENLABS_PROVIDER_ENABLED=false");
    if (!getElevenLabsConfig(env).hasApiKey) reasons.push("ELEVENLABS_API_KEY missing");
  }
  if (kind === "upscale") reasons.push("live upscale is not part of 6G");
  return reasons;
}
