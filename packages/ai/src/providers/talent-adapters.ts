import type { AppEnv } from "@shotbro/config/env";
import { evaluateLiveMediaPolicy } from "@shotbro/config/live-media-policy";
import { getElevenLabsConfig, getHeyGenConfig } from "@shotbro/config/vendor-providers";
import type { TalentOperation } from "@shotbro/contracts";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import { ElevenLabsVoiceAdapter } from "./elevenlabs-voice-adapter.js";
import { HeyGenAvatarAdapter } from "./heygen-avatar-adapter.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { MockElevenLabsVoiceProvider, MockHeyGenAvatarProvider } from "./mock-talent-providers.js";

export type TalentAdapterSet =
  | { mock: true; voice: MockElevenLabsVoiceProvider; avatar: MockHeyGenAvatarProvider; reasons: string[] }
  | { mock: false; voice: ElevenLabsVoiceAdapter; avatar: HeyGenAvatarAdapter; reasons: [] };

/**
 * Why a live talent operation may not run. Empty list ⇒ allowed.
 * Every gate is checked again in the worker right before the network call (defense in depth).
 */
export function liveTalentBlockers(env: AppEnv, operation: TalentOperation, opts: { approved: boolean }): string[] {
  const reasons: string[] = [];
  if (new ExecutionPolicyEngine(env).resolveMode() !== "LIVE_APPROVED") reasons.push("execution mode is not LIVE_APPROVED");
  const media = evaluateLiveMediaPolicy(env);
  if (!media.liveMediaAllowed) reasons.push(...media.reasons);
  if (operation === "AVATAR_TRAIN") {
    if (!env.HEYGEN_PROVIDER_ENABLED) reasons.push("HEYGEN_PROVIDER_ENABLED=false");
    if (!getHeyGenConfig(env).hasApiKey) reasons.push("HEYGEN_API_KEY missing");
    if (!env.AVATAR_GENERATION_ENABLED) reasons.push("AVATAR_GENERATION_ENABLED=false");
  } else {
    if (!env.ELEVENLABS_PROVIDER_ENABLED) reasons.push("ELEVENLABS_PROVIDER_ENABLED=false");
    if (!getElevenLabsConfig(env).hasApiKey) reasons.push("ELEVENLABS_API_KEY missing");
    if (operation === "VOICE_CLONE" && !env.VOICE_CLONING_ENABLED) reasons.push("VOICE_CLONING_ENABLED=false");
  }
  if (!opts.approved) reasons.push("no approved cost confirmation");
  return reasons;
}

/** Mock adapters whenever any live gate is closed; real adapters only when all gates are open. */
export function createTalentAdapters(
  env: AppEnv,
  operation: TalentOperation,
  opts: { approved: boolean; transport?: HttpTransport },
): TalentAdapterSet {
  const reasons = liveTalentBlockers(env, operation, opts);
  if (reasons.length) {
    return { mock: true, voice: new MockElevenLabsVoiceProvider(), avatar: new MockHeyGenAvatarProvider(), reasons };
  }
  const transport = opts.transport ?? new BlockedHttpTransport();
  return {
    mock: false,
    voice: new ElevenLabsVoiceAdapter(env, transport),
    avatar: new HeyGenAvatarAdapter(env, transport),
    reasons: [],
  };
}
