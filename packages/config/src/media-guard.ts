import type { AppEnv } from "./env.js";

const MEDIA_TOOL_IDS = new Set([
  "generate.image",
  "generate.video",
  "generate.voice",
]);

/** Phase 5K default: no live AI media; mock adapters only. */
export function assertMediaGenerationBlocked(env: AppEnv, toolId: string): void {
  if (!MEDIA_TOOL_IDS.has(toolId)) return;
  if (env.MEDIA_GENERATION_ENABLED !== true) {
    throw new Error(
      `${toolId} blocked: MEDIA_GENERATION_ENABLED=false (Phase 5K — use mock production only)`,
    );
  }
  if (toolId === "generate.image" && env.IMAGE_GENERATION_ENABLED !== true) {
    throw new Error(`${toolId} blocked: IMAGE_GENERATION_ENABLED=false`);
  }
  if (toolId === "generate.video" && env.VIDEO_GENERATION_ENABLED !== true) {
    throw new Error(`${toolId} blocked: VIDEO_GENERATION_ENABLED=false`);
  }
  if (env.MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED === true) {
    throw new Error("MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED must stay false in Phase 5K");
  }
}
