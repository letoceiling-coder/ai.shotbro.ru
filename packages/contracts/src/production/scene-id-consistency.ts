/** Mock orchestrator template ids — not used for user-authored script/scenes. */
export const MOCK_TEMPLATE_SCENE_IDS = ["scene-1", "scene-2", "scene-3"] as const;

export function isMockTemplateSceneId(sceneId: string): boolean {
  return (MOCK_TEMPLATE_SCENE_IDS as readonly string[]).includes(sceneId);
}

export function scriptSceneIdsFromPayload(payload: unknown): string[] {
  const scenes = (payload as { scenes?: { id?: string; sceneId?: string }[] } | undefined)?.scenes ?? [];
  return scenes.map((s) => s.id ?? s.sceneId).filter((id): id is string => Boolean(id));
}

/** User edited script via API or sync — must not be replaced by mock agent template. */
export function isUserAuthoredScriptPayload(payload: unknown): boolean {
  const ids = scriptSceneIdsFromPayload(payload);
  if (!ids.length) return false;
  if (ids.some((id) => !isMockTemplateSceneId(id))) return true;
  if (ids.length > MOCK_TEMPLATE_SCENE_IDS.length) return true;
  return false;
}

export function isOrchestratorMockScriptPayload(payload: unknown): boolean {
  const p = payload as { mock?: boolean; scenes?: { id?: string }[] };
  if (p?.mock !== true) return false;
  const ids = scriptSceneIdsFromPayload(payload);
  return ids.length > 0 && ids.every((id) => isMockTemplateSceneId(id));
}

export function isOrchestratorMockStoryboardPayload(payload: unknown): boolean {
  const p = payload as { mock?: boolean; frames?: unknown[]; scenes?: unknown[] };
  if (p?.mock !== true) return false;
  return Array.isArray(p.frames) && !(p.scenes?.length);
}

export function storyboardSceneIdsFromPayload(payload: unknown): string[] {
  const p = payload as {
    scenes?: { sceneId?: string; order?: number }[];
    frames?: { sceneId?: string; sequence?: number }[];
  };
  if (p.scenes?.length) {
    return [...p.scenes]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => s.sceneId)
      .filter((id): id is string => Boolean(id));
  }
  if (p.frames?.length) {
    return [...p.frames]
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((f) => f.sceneId)
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

export function timelineVideoSceneIdsFromPayload(payload: unknown): string[] {
  const tracks = (payload as { tracks?: { type?: string; clips?: { sceneId?: string; order?: number }[] }[] })?.tracks ?? [];
  const video = tracks.find((t) => t.type === "VIDEO");
  const clips = [...(video?.clips ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return clips.map((c) => c.sceneId).filter((id): id is string => Boolean(id));
}

/** All non-empty id lists must match exactly (same stable scene ids across documents). */
export function sceneIdChainAligned(input: {
  scriptPayload?: unknown;
  storyboardPayload?: unknown;
  timelinePayload?: unknown;
}): boolean {
  const lists = [
    scriptSceneIdsFromPayload(input.scriptPayload),
    storyboardSceneIdsFromPayload(input.storyboardPayload),
    timelineVideoSceneIdsFromPayload(input.timelinePayload),
  ].filter((l) => l.length > 0);
  if (lists.length < 2) return true;
  const [first, ...rest] = lists;
  return rest.every((l) => l.length === first!.length && l.every((id, i) => id === first![i]));
}
