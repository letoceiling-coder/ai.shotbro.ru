import type { AppEnv } from "@shotbro/config/env";
import { z } from "zod";
import type { ProductionStoragePort } from "../ports/production-storage.js";
import { ToolExecutor, type ToolExecutionDelegates } from "../tool-executor.js";
import { registerPhase4ToolHandlers } from "./tool-handlers/register.js";
import { registerMultiproviderTools } from "./tool-handlers/multiprovider-tools.js";
import { registerPhase5CreativeStudioTools } from "./tool-handlers/phase5-creative-tools.js";
import { registerPhase6TalentTools } from "./tool-handlers/phase6-talent-tools.js";
import { registerPhase5PromptStudioTools } from "./tool-handlers/phase5-prompt-tools.js";
import { registerPhase5TimelineTools } from "./tool-handlers/phase5-timeline-tools.js";
import { isCreativeLlmLiveEnabled } from "@shotbro/config";
import { isProductionBootstrapUserMessage } from "./studio-intent.js";
import {
  planCreativeIntent,
  shouldUseMockCreativePlanner,
} from "./creative-intent-planner.js";
import { runCreativeLlmLoop } from "./creative-llm-loop.js";
import {
  type AgentToolResultEnvelope,
  toolError,
  toolSuccess,
} from "./tool-result-envelope.js";

type TurnSession = {
  assets: Array<{ id: string; mimeType: string; originalName?: string; status?: string }>;
  scenes: Array<{ sceneId: string; title?: string }>;
  timelineRevision?: number;
};

export type CreativeAgentTurnResult = {
  status: "completed" | "no_intent" | "failed" | "stopped";
  mockAgent: boolean;
  llmLive?: boolean;
  planIntent?: string;
  assistantMessage?: string;
  results: AgentToolResultEnvelope[];
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
};

export class CreativeAgentRuntime {
  private readonly executor: ToolExecutor;

  constructor(private readonly env: AppEnv) {
    this.executor = new ToolExecutor(env);
    registerPhase4ToolHandlers(this.executor);
    registerMultiproviderTools(this.executor, env);
    registerPhase5CreativeStudioTools(this.executor);
    registerPhase6TalentTools(this.executor);
    registerPhase5PromptStudioTools(this.executor);
    registerPhase5TimelineTools(this.executor);
    this.registerCompositeTools();
  }

  private registerCompositeTools() {
    this.executor.register(
      "search_project_assets",
      z.object({
        filter: z.enum(["image", "video", "audio", "upload", "all"]).default("all"),
        status: z.enum(["READY", "PROCESSING", "FAILED", "any"]).default("READY"),
        q: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(12),
      }),
      async (input, ctx) => {
        if (!ctx.delegates?.searchAssets) throw new Error("search_project_assets: delegate missing");
        const items = await ctx.delegates.searchAssets({
          projectId: ctx.projectId,
          userId: ctx.userId,
          filter: input.filter as string,
          status: input.status as string,
          q: input.q as string | undefined,
          limit: input.limit as number,
        });
        return { items, count: items.length, mockAgent: true };
      },
    );

    this.executor.register(
      "set_scene_first_frame_by_ordinal",
      z.object({
        sceneOrdinal: z.number().int().positive(),
        pickAssetIndex: z.number().int().min(0).default(0),
        assetId: z.string().optional(),
      }),
      async (input, ctx) => {
        const parsed = z
          .object({
            sceneOrdinal: z.number().int().positive(),
            pickAssetIndex: z.number().int().min(0).default(0),
            assetId: z.string().optional(),
          })
          .parse(input);
        const session = getSession(ctx);
        if (!session.scenes.length && ctx.delegates?.getStoryboard) {
          const board = await ctx.delegates.getStoryboard({
            projectId: ctx.projectId,
            userId: ctx.userId,
          });
          const scenes = (board.storyboard as { scenes?: TurnSession["scenes"] } | null)?.scenes;
          if (scenes?.length) session.scenes = scenes;
        }
        const scene = session.scenes[parsed.sceneOrdinal - 1];
        if (!scene) throw new Error(`scene ordinal ${parsed.sceneOrdinal} not found`);
        let assetId =
          parsed.assetId ??
          session.assets.filter((a) => a.mimeType.startsWith("image/"))[parsed.pickAssetIndex]?.id;
        if (!assetId && ctx.delegates?.searchAssets) {
          const found = await ctx.delegates.searchAssets({
            projectId: ctx.projectId,
            userId: ctx.userId,
            filter: "image",
            status: "READY",
            limit: 12,
          });
          if (found.length) session.assets = found;
          assetId = found[parsed.pickAssetIndex]?.id;
        }
        if (!assetId) throw new Error("no READY image asset in session context");
        if (!ctx.delegates?.setSceneFrame) throw new Error("set_scene_first_frame: delegate missing");
        const res = await ctx.delegates.setSceneFrame({
          projectId: ctx.projectId,
          userId: ctx.userId,
          sceneId: scene.sceneId,
          frame: "first",
          assetId,
        });
        return { ...res, sceneOrdinal: parsed.sceneOrdinal, mockAgent: true };
      },
    );

    this.executor.register(
      "pick_asset_from_last_search",
      z.object({
        index: z.number().int().positive(),
        assetId: z.string().optional(),
      }),
      async (input, ctx) => {
        const parsed = z
          .object({ index: z.number().int().positive(), assetId: z.string().optional() })
          .parse(input);
        const session = getSession(ctx);
        if (parsed.assetId) return { assetId: parsed.assetId, picked: true };
        const hit = session.assets[parsed.index - 1];
        if (!hit) throw new Error(`asset index ${parsed.index} not in last search (${session.assets.length} items)`);
        return { assetId: hit.id, mimeType: hit.mimeType, originalName: hit.originalName, picked: true };
      },
    );

    this.executor.register(
      "improve_scene_video_prompt",
      z.object({
        sceneOrdinal: z.number().int().positive().optional(),
        sceneId: z.string().optional(),
      }),
      async (input, ctx) => {
        const parsed = z
          .object({
            sceneOrdinal: z.number().int().positive().optional(),
            sceneId: z.string().optional(),
          })
          .parse(input);
        const session = getSession(ctx);
        let sceneId = parsed.sceneId;
        if (!sceneId && parsed.sceneOrdinal) {
          sceneId = session.scenes[parsed.sceneOrdinal - 1]?.sceneId;
        }
        if (!sceneId) throw new Error("sceneId or sceneOrdinal required");
        const scene = session.scenes.find((s) => s.sceneId === sceneId);
        if (!ctx.delegates?.prepareScenePrompt || !ctx.delegates?.saveScenePrompt) {
          throw new Error("improve_scene_video_prompt: delegate missing");
        }
        const prep = await ctx.delegates.prepareScenePrompt({
          projectId: ctx.projectId,
          userId: ctx.userId,
          sceneId,
          focus: "video",
        });
        const bundle = (prep.bundle ?? {}) as Record<string, unknown>;
        const video = (bundle.video ?? {}) as Record<string, unknown>;
        const improved = {
          ...bundle,
          video: {
            ...video,
            sceneAction: `${String(video.sceneAction ?? scene?.title ?? "Scene")} · улучшено агентом`,
            motionNotes: "Плавное движение камеры, акцент на героине кадра",
          },
        };
        const saved = await ctx.delegates.saveScenePrompt({
          projectId: ctx.projectId,
          userId: ctx.userId,
          sceneId,
          bundle: improved,
          changeNote: "Creative agent video prompt improve",
        });
        return { sceneId, ...saved, mockAgent: true };
      },
    );

    this.executor.register(
      "assign_video_to_scene_clip",
      z.object({
        sceneOrdinal: z.number().int().positive(),
        pickAssetIndex: z.number().int().min(0).default(0),
        assetId: z.string().optional(),
      }),
      async (input, ctx) => {
        const parsed = z
          .object({
            sceneOrdinal: z.number().int().positive(),
            pickAssetIndex: z.number().int().min(0).default(0),
            assetId: z.string().optional(),
          })
          .parse(input);
        const session = getSession(ctx);
        if (!session.scenes.length && ctx.delegates?.getStoryboard) {
          const board = await ctx.delegates.getStoryboard({
            projectId: ctx.projectId,
            userId: ctx.userId,
          });
          const scenes = (board.storyboard as { scenes?: TurnSession["scenes"] } | null)?.scenes;
          if (scenes?.length) session.scenes = scenes;
        }
        const scene = session.scenes[parsed.sceneOrdinal - 1];
        if (!scene) throw new Error(`scene ordinal ${parsed.sceneOrdinal} not found`);
        let assetId =
          parsed.assetId ??
          session.assets.filter((a) => a.mimeType.startsWith("video/"))[parsed.pickAssetIndex]?.id;
        if (!assetId && ctx.delegates?.searchAssets) {
          const found = await ctx.delegates.searchAssets({
            projectId: ctx.projectId,
            userId: ctx.userId,
            filter: "video",
            status: "READY",
            limit: 12,
          });
          assetId = found[parsed.pickAssetIndex]?.id;
        }
        if (!assetId) throw new Error("no READY video asset in session context");
        if (!ctx.delegates?.getTimeline || !ctx.delegates?.updateTimelineClip) {
          throw new Error("assign_video_to_scene_clip: delegate missing");
        }
        const tl = await ctx.delegates.getTimeline({ projectId: ctx.projectId, userId: ctx.userId });
        const tracks = (tl.tracks ?? []) as Array<{ id: string; type: string; clips: Array<{ clipId: string; sceneId?: string }> }>;
        const videoTrack = tracks.find((t) => t.type === "VIDEO") ?? tracks[0];
        const clip = videoTrack?.clips.find((c) => c.sceneId === scene.sceneId) ?? videoTrack?.clips[parsed.sceneOrdinal - 1];
        if (!clip) throw new Error("timeline clip for scene not found");
        const updated = await ctx.delegates.updateTimelineClip({
          projectId: ctx.projectId,
          userId: ctx.userId,
          clip: { ...clip, assetId, trackId: videoTrack!.id },
          expectedRevision: session.timelineRevision ?? (tl.revision as number | undefined),
        });
        session.timelineRevision = updated.revision as number | undefined;
        return { clipId: clip.clipId, assetId, sceneId: scene.sceneId, ...updated, mockAgent: true };
      },
    );
  }

  async executeToolCall(input: {
    runId: string;
    projectId: string;
    userId: string;
    userMessage?: string;
    storage: ProductionStoragePort;
    conversationId?: string;
    delegates?: ToolExecutionDelegates;
    toolName: string;
    arguments: Record<string, unknown>;
    idempotencyKey: string;
    session?: TurnSession;
  }): Promise<AgentToolResultEnvelope> {
    const session = input.session ?? { assets: [], scenes: [] };
    const sessionCtx = { session };
    try {
      const toolCtx = {
        env: this.env,
        storage: input.storage,
        runId: input.runId,
        projectId: input.projectId,
        userId: input.userId,
        conversationId: input.conversationId,
        delegates: input.delegates,
        [SESSION]: sessionCtx,
      } as Parameters<ToolExecutor["execute"]>[2];
      const raw = await this.executor.execute(input.toolName, input.arguments, toolCtx, {
        idempotencyKey: input.idempotencyKey,
        timeoutMs: 45_000,
      });
      await this.refreshSession(session, input.toolName, raw, input);
      return toolSuccess({
        projectId: input.projectId,
        toolName: input.toolName,
        humanReadableSummary: summarizeTool(input.toolName, raw),
        assetId: typeof raw.assetId === "string" ? raw.assetId : undefined,
        sceneId: typeof raw.sceneId === "string" ? raw.sceneId : undefined,
        revision: typeof raw.revision === "number" ? raw.revision : undefined,
        documentId: typeof raw.documentId === "string" ? raw.documentId : undefined,
        resultingAction: input.toolName,
        deepLink: deepLinkFor(input.toolName, raw),
        payload: raw,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tool failed";
      return toolError({
        projectId: input.projectId,
        toolName: input.toolName,
        errorCode: "TOOL_FAILED",
        humanReadableSummary: message,
        resultingAction: input.toolName,
      });
    }
  }

  async runCreativeTurn(input: {
    runId: string;
    projectId: string;
    userId: string;
    userMessage: string;
    storage: ProductionStoragePort;
    conversationId?: string;
    delegates?: ToolExecutionDelegates;
    memoryContext?: string;
    sessionSeed?: TurnSession;
  }): Promise<CreativeAgentTurnResult> {
    const session: TurnSession = input.sessionSeed ?? { assets: [], scenes: [] };

    if (isProductionBootstrapUserMessage(input.userMessage)) {
      return {
        status: "no_intent",
        mockAgent: false,
        results: [],
      };
    }

    if (!shouldUseMockCreativePlanner(this.env, input.userMessage)) {
      const llm = await runCreativeLlmLoop({
        env: this.env,
        runtime: this,
        runId: input.runId,
        projectId: input.projectId,
        userId: input.userId,
        userMessage: input.userMessage,
        storage: input.storage,
        conversationId: input.conversationId,
        delegates: input.delegates,
        memoryContext: input.memoryContext,
      });
      return {
        status: llm.status,
        mockAgent: false,
        llmLive: true,
        assistantMessage: llm.assistantMessage,
        results: llm.results,
        usage: llm.usage,
        error: llm.error,
      };
    }

    const plan = planCreativeIntent(input.userMessage);
    if (!plan) {
      return {
        status: "no_intent",
        mockAgent: !isCreativeLlmLiveEnabled(this.env),
        results: [],
        assistantMessage: isCreativeLlmLiveEnabled(this.env)
          ? undefined
          : "Не удалось распознать задачу (mock planner). Включите LLM_LIVE_EXECUTION_ENABLED для свободного текста.",
      };
    }

    const results: AgentToolResultEnvelope[] = [];
    for (const tc of plan.toolCalls) {
      const envelope = await this.executeToolCall({
        ...input,
        toolName: tc.name,
        arguments: tc.arguments,
        idempotencyKey: `${input.runId}:creative:${tc.id}`,
        session,
      });
      results.push(envelope);
      if (!envelope.success) {
        return { status: "failed", mockAgent: true, planIntent: plan.intent, results, error: envelope.humanReadableSummary };
      }
    }
    return { status: "completed", mockAgent: true, planIntent: plan.intent, results };
  }

  buildMemoryContext(session: TurnSession): string {
    const lines: string[] = [];
    if (session.assets.length) {
      lines.push(
        "Last asset search:",
        ...session.assets.slice(0, 12).map((a, i) => `${i + 1}. ${a.id} ${a.originalName ?? ""} ${a.mimeType}`),
      );
    }
    if (session.scenes.length) {
      lines.push(
        "Storyboard scenes:",
        ...session.scenes.map((s, i) => `${i + 1}. ${s.sceneId} ${s.title ?? ""}`),
      );
    }
    return lines.join("\n");
  }

  private async refreshSession(
    session: TurnSession,
    toolName: string,
    raw: Record<string, unknown>,
    input: { delegates?: ToolExecutionDelegates; projectId: string; userId: string },
  ) {
    if (toolName === "search_project_assets" && Array.isArray(raw.items)) {
      session.assets = raw.items as TurnSession["assets"];
    }
    if (toolName === "sync_storyboard_from_script" || toolName === "get_storyboard") {
      if (input.delegates?.getStoryboard) {
        const board = await input.delegates.getStoryboard({ projectId: input.projectId, userId: input.userId });
        const scenes = (board.storyboard as { scenes?: Array<{ sceneId: string; title?: string }> } | null)?.scenes;
        if (scenes?.length) session.scenes = scenes;
      }
    }
    if (toolName === "get_timeline" && typeof raw.revision === "number") {
      session.timelineRevision = raw.revision;
    }
    if (toolName === "set_scene_first_frame_by_ordinal" && !session.scenes.length && input.delegates?.getStoryboard) {
      const board = await input.delegates.getStoryboard({ projectId: input.projectId, userId: input.userId });
      const scenes = (board.storyboard as { scenes?: Array<{ sceneId: string; title?: string }> } | null)?.scenes;
      if (scenes?.length) session.scenes = scenes;
    }
  }
}

const SESSION = Symbol("creativeTurnSession");

function getSession(ctx: unknown): TurnSession {
  const wrap = (ctx as Record<symbol, { session: TurnSession }>)[SESSION];
  if (!wrap?.session) throw new Error("creative session missing");
  return wrap.session;
}

function summarizeTool(name: string, raw: Record<string, unknown>): string {
  if (name === "search_project_assets") return `Найдено материалов: ${raw.count ?? 0}`;
  if (name === "set_scene_first_frame_by_ordinal") return `FIRST_FRAME назначен для сцены ${raw.sceneId ?? ""}`;
  if (name === "improve_scene_video_prompt") return `Video prompt сохранён (v${raw.version ?? "?"})`;
  if (name === "assign_video_to_scene_clip") return `Видео привязано к клипу ${raw.clipId ?? ""}`;
  if (name === "estimate_cost") return `Оценка стоимости: ${JSON.stringify(raw.totalUsd ?? raw).slice(0, 80)}`;
  if (name === "compare_models") return "Сравнение моделей выполнено";
  if (name === "get_studio_capabilities") return "Возможности студии загружены";
  if (name === "list_voices") return "Список голосов загружен";
  if (name === "list_avatars") return "Список аватаров загружен";
  if (name === "create_voice_profile") return "Голос создан (черновик или готов из библиотеки)";
  if (name === "create_avatar_profile") return "Аватар создан (черновик)";
  if (name === "assign_talent_to_character") return "Аватар/голос привязан к персонажу";
  if (name === "propose_talent_operation") {
    const q = (raw.quote ?? {}) as { estimatedLiveUsd?: number; mock?: boolean };
    return `Предложено действие — ждёт вашего подтверждения (≈$${Number(q.estimatedLiveUsd ?? 0).toFixed(2)}${q.mock ? ", тест: $0" : ""})`;
  }
  return `${name}: OK`;
}

function deepLinkFor(
  name: string,
  raw: Record<string, unknown>,
): AgentToolResultEnvelope["deepLink"] | undefined {
  if (name === "assign_talent_to_character") return { creativeSection: "characters" };
  if (name === "create_voice_profile") return { creativeSection: "voices" };
  if (name === "create_avatar_profile") return { creativeSection: "avatars" };
  // The price card lives in the chat: keep the user there even if a draft was created in the same turn.
  if (name === "propose_talent_operation") return { creativeSection: "chat" };
  if (name === "search_project_assets") {
    const first = (raw.items as Array<{ id: string }> | undefined)?.[0];
    return first ? { creativeSection: "assets", assetId: first.id } : { creativeSection: "assets" };
  }
  if (name.includes("scene") || name.includes("storyboard")) {
    return { creativeSection: "storyboard", sceneId: typeof raw.sceneId === "string" ? raw.sceneId : undefined };
  }
  if (name.includes("timeline") || name.includes("clip")) {
    return {
      creativeSection: "timeline",
      sceneId: typeof raw.sceneId === "string" ? raw.sceneId : undefined,
      clipId: typeof raw.clipId === "string" ? raw.clipId : undefined,
    };
  }
  if (name.includes("prompt")) return { creativeSection: "prompts", sceneId: typeof raw.sceneId === "string" ? raw.sceneId : undefined };
  if (name === "estimate_cost" || name === "compare_models") return { creativeSection: "models" };
  return undefined;
}
