import type { AppEnv } from "./env.js";

export type FalServerConfig = {
  hasApiKey: boolean;
  queueBaseUrl: string;
};

export type ElevenLabsServerConfig = {
  hasApiKey: boolean;
  baseUrl: string;
};

export function getFalConfig(env: AppEnv): FalServerConfig {
  return {
    hasApiKey: Boolean(env.FAL_API_KEY && env.FAL_API_KEY.length > 8),
    queueBaseUrl: "https://queue.fal.run",
  };
}

export function getElevenLabsConfig(env: AppEnv): ElevenLabsServerConfig {
  return {
    hasApiKey: Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY.length > 8),
    baseUrl: env.ELEVENLABS_BASE_URL,
  };
}

export type HeyGenServerConfig = {
  hasApiKey: boolean;
  baseUrl: string;
};

export function getHeyGenConfig(env: AppEnv): HeyGenServerConfig {
  return {
    hasApiKey: Boolean(env.HEYGEN_API_KEY && env.HEYGEN_API_KEY.length > 8),
    baseUrl: env.HEYGEN_BASE_URL,
  };
}
