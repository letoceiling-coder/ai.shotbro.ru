import type { AppEnv } from "@shotbro/config/env";
import { isCreativeLlmLiveEnabled } from "@shotbro/config";

export type PlannedToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type CreativeIntentPlan = {
  intent: string;
  mockAgent: true;
  toolCalls: PlannedToolCall[];
  /** 1-based scene ordinal from NL («вторая сцена» → 2) */
  sceneOrdinal?: number;
};

const ORDINALS: Record<string, number> = {
  перв: 1,
  first: 1,
  "1-": 1,
  втор: 2,
  second: 2,
  "2-": 2,
  трет: 3,
  third: 3,
  "3-": 3,
  четверт: 4,
  fourth: 4,
};

/** Phase 3/4 mock production E2E bootstrap — must route to AgentRuntime, not OpenRouter creative loop. */
export function isProductionBootstrapUserMessage(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return (
    (lower.includes("ролик") || lower.includes("реклам")) &&
    (lower.includes("15") || lower.includes("9:16") || lower.includes("testco") || lower.includes("mock"))
  );
}

function detectSceneOrdinal(text: string): number | undefined {
  const lower = text.toLowerCase();
  for (const [key, n] of Object.entries(ORDINALS)) {
    if (lower.includes(`${key}`) && (lower.includes("сцен") || lower.includes("scene"))) return n;
  }
  const m = lower.match(/сцен[аы]?\s*#?\s*(\d+)/);
  if (m) return Number(m[1]);
  return undefined;
}

/** Deterministic mock NL → tool plan (staging E2E + Phase 5K). No live LLM. */
/** E2E / fallback only when live LLM is off or explicit mock mode. */
export function shouldUseMockCreativePlanner(env: AppEnv, userMessage: string): boolean {
  if (process.env.CREATIVE_AGENT_MOCK_PLANNER === "1") return true;
  if (/phase5k/i.test(userMessage)) return true;
  if (!isCreativeLlmLiveEnabled(env)) return true;
  return false;
}

export function planCreativeIntent(userMessage: string): CreativeIntentPlan | null {
  const lower = userMessage.toLowerCase();
  const sceneOrdinal = detectSceneOrdinal(userMessage);

  if (isProductionBootstrapUserMessage(userMessage)) return null;

  const creativeSignals =
    lower.includes("phase5k") ||
    lower.includes("библиотек") ||
    lower.includes("first_frame") ||
    lower.includes("первым кадром") ||
    lower.includes("first frame") ||
    lower.includes("улучши") && lower.includes("prompt") ||
    lower.includes("улучши") && lower.includes("промпт") ||
    (lower.includes("найди") && (lower.includes("фото") || lower.includes("изображ") || lower.includes("видео"))) ||
    lower.includes("timeline") ||
    lower.includes("монтаж") ||
    lower.includes("раскадров");

  if (!creativeSignals) return null;

  const ordinal = sceneOrdinal ?? 2;
  const toolCalls: PlannedToolCall[] = [];
  let step = 0;
  const nextId = () => `tc_${++step}`;

  if (lower.includes("раскадров") || lower.includes("storyboard") || lower.includes("сцен")) {
    toolCalls.push({ id: nextId(), name: "get_storyboard", arguments: {} });
  }

  if (lower.includes("sync") || lower.includes("сценари") || creativeSignals) {
    toolCalls.push({ id: nextId(), name: "sync_storyboard_from_script", arguments: {} });
  }

  if (
    lower.includes("библиотек") ||
    lower.includes("найди") ||
    lower.includes("фото") ||
    lower.includes("изображ") ||
    lower.includes("phase5k")
  ) {
    toolCalls.push({
      id: nextId(),
      name: "search_project_assets",
      arguments: {
        filter: lower.includes("видео") || lower.includes("mp4") ? "video" : "image",
        status: "READY",
        limit: 8,
      },
    });
  }

  if (
    lower.includes("first_frame") ||
    lower.includes("первым кадром") ||
    lower.includes("first frame") ||
    lower.includes("phase5k")
  ) {
    toolCalls.push({
      id: nextId(),
      name: "set_scene_first_frame_by_ordinal",
      arguments: { sceneOrdinal: ordinal, pickAssetIndex: 0 },
    });
  }


  if (lower.includes("улучши") && (lower.includes("video") || lower.includes("видео") || lower.includes("промпт"))) {
    toolCalls.push({
      id: nextId(),
      name: "improve_scene_video_prompt",
      arguments: { sceneOrdinal: ordinal },
    });
  }

  if (lower.includes("модел") || lower.includes("model") || lower.includes("phase5k")) {
    toolCalls.push({
      id: nextId(),
      name: "compare_models",
      arguments: { task: "video" },
    });
    toolCalls.push({
      id: nextId(),
      name: "get_scene_model_capabilities",
      arguments: { modelId: "mock/video-std", operation: "IMAGE_TO_VIDEO" },
    });
  }

  if (lower.includes("стоим") || lower.includes("cost") || lower.includes("phase5k")) {
    toolCalls.push({ id: nextId(), name: "estimate_cost", arguments: { strategy: "balance" } });
  }

  if (
    lower.includes("timeline") ||
    lower.includes("монтаж") ||
    lower.includes("клип") ||
    lower.includes("phase5k") ||
    (lower.includes("видео") && lower.includes("прив"))
  ) {
    toolCalls.push({ id: nextId(), name: "create_timeline_from_storyboard", arguments: { preview: false } });
    toolCalls.push({ id: nextId(), name: "get_timeline", arguments: {} });
    toolCalls.push({
      id: nextId(),
      name: "assign_video_to_scene_clip",
      arguments: { sceneOrdinal: ordinal, pickAssetIndex: 0 },
    });
  }

  if (!toolCalls.length) return null;

  return {
    intent: "creative_workspace",
    mockAgent: true,
    toolCalls,
    sceneOrdinal: ordinal,
  };
}
