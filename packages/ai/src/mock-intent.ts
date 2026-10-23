import type { ProductionBrief, ProductionPlan, ScriptDocument, StoryboardDocument } from "@shotbro/contracts";

/** Deterministic parsing — no LLM calls in Phase 3 mock mode. */
export function buildMockBriefFromRequest(userRequest: string): ProductionBrief {
  const lower = userRequest.toLowerCase();
  const durationMatch = userRequest.match(/(\d+)\s*(сек|sec|second)/i);
  const durationSeconds = durationMatch ? Number(durationMatch[1]) : 15;
  const aspectRatio = /9\s*:\s*16|vertical|tiktok|reels/i.test(userRequest)
    ? "9:16"
    : /16\s*:\s*9|horizontal|youtube/i.test(userRequest)
      ? "16:9"
      : "9:16";

  const missingInfo: string[] = [];
  if (!/бренд|brand|company|компан/i.test(userRequest)) missingInfo.push("Название и описание бренда");
  if (!/логотип|logo/i.test(userRequest)) missingInfo.push("Логотип или референс бренда");
  if (!/слоган|tagline/i.test(userRequest)) missingInfo.push("Финальный слоган");

  return {
    schemaVersion: 1,
    goal: userRequest.trim().slice(0, 2000),
    format: "short_form_ad",
    durationSeconds,
    aspectRatio,
    style: /кинемат|cinematic/i.test(lower) ? "cinematic" : "advertising",
    brandName: extractBrandHint(userRequest),
    constraints: [],
    missingInfo,
    mock: true,
  };
}

function extractBrandHint(text: string): string | undefined {
  const m = text.match(/бренд[а]?\s+([^\s,.]+)/i) ?? text.match(/brand\s+([^\s,.]+)/i);
  return m?.[1];
}

export function buildMockPlan(brief: ProductionBrief): ProductionPlan {
  return {
    schemaVersion: 1,
    narrativeStructure: "hook → product showcase → logo + tagline",
    deliverables: ["master_mp4", "poster", "version_history"],
    approvalPoints: ["plan", "script", "storyboard", "cost", "production"],
    modelStrategy: "balance",
    estimatedBudgetUsd: 0,
    mock: true,
  };
}

export function buildMockScript(brief: ProductionBrief, plan: ProductionPlan): ScriptDocument {
  const sceneDur = Math.max(3, Math.floor(brief.durationSeconds / 3));
  const scenes = [
    {
      id: "scene-1",
      sequence: 1,
      title: "Hook",
      durationSeconds: sceneDur,
      description: "Presenter introduces the brand and value proposition.",
      narration: "Opening voiceover aligned with brand tone.",
    },
    {
      id: "scene-2",
      sequence: 2,
      title: "Showcase",
      durationSeconds: sceneDur,
      description: "Product / outfit highlights with dynamic cuts.",
    },
    {
      id: "scene-3",
      sequence: 3,
      title: "Outro",
      durationSeconds: Math.max(2, brief.durationSeconds - sceneDur * 2),
      description: "Logo lockup and tagline on brand background.",
      narration: plan.narrativeStructure.includes("tagline") ? "Tagline read." : undefined,
    },
  ];
  return {
    schemaVersion: 1,
    title: "Mock script",
    totalDurationSeconds: brief.durationSeconds,
    scenes,
    mock: true,
  };
}

export function buildMockStoryboard(script: ScriptDocument): StoryboardDocument {
  return {
    schemaVersion: 1,
    title: "Mock storyboard",
    frames: script.scenes.map((s) => ({
      sceneId: s.id,
      sequence: s.sequence,
      durationSeconds: s.durationSeconds,
      visualDescription: s.description,
      firstFramePrompt: `[MOCK] ${s.title}: ${s.description}`.slice(0, 2500),
      videoMotionPrompt: `[MOCK] Gentle camera move, ${s.durationSeconds}s`,
      narration: s.narration,
    })),
    mock: true,
  };
}
