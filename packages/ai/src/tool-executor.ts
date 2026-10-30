import type { AppEnv } from "@shotbro/config/env";
import { assertExternalProviderExecutionAllowed, assertMediaGenerationBlocked } from "@shotbro/config";
import { z } from "zod";
import type { ProductionStoragePort } from "./ports/production-storage.js";
import { PHASE4_TOOLS, type Phase4ToolDefinition } from "./agent/phase4-tool-catalog.js";
import type { ToolSideEffectClass } from "./tool-side-effects.js";

const emptyInput = z.object({}).strict();

export type ToolHandler = (input: Record<string, unknown>, ctx: ToolRunContext) => Promise<Record<string, unknown>>;

/** Phase 6C: reusable avatars/voices. The agent can draft and propose; paid work starts only after the user approves. */
export type TalentDelegates = {
  capabilities: (input: { projectId: string; userId: string }) => Promise<Record<string, unknown>>;
  listVoices: (input: { userId: string; language?: string; gender?: string }) => Promise<Record<string, unknown>>;
  listAvatars: (input: { userId: string }) => Promise<Record<string, unknown>>;
  createVoice: (input: { userId: string; body: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  createAvatar: (input: { userId: string; body: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  assignToCharacter: (input: {
    userId: string;
    projectId: string;
    characterId: string;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  propose: (input: {
    userId: string;
    projectId: string;
    conversationId?: string;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
};

/** Phase 6F: scene canvas. The agent reads the canvas and proposes runs; jobs start only after «Утвердить». */
export type CanvasDelegates = {
  get: (input: { projectId: string; userId: string }) => Promise<Record<string, unknown>>;
  propose: (input: {
    projectId: string;
    userId: string;
    conversationId?: string;
    scope: "all" | "scene";
    sceneOrdinal?: number;
  }) => Promise<Record<string, unknown>>;
};

export type ToolExecutionDelegates = {
  talent?: TalentDelegates;
  canvas?: CanvasDelegates;
  listAssets?: (projectId: string, userId: string) => Promise<Array<{ id: string; mimeType: string; originalName?: string }>>;
  searchAssets?: (input: {
    projectId: string;
    userId: string;
    filter: string;
    status: string;
    q?: string;
    limit: number;
  }) => Promise<
    Array<{ id: string; mimeType: string; originalName?: string; status?: string; roles?: string[] }>
  >;
  attachReference?: (input: {
    projectId: string;
    userId: string;
    assetId: string;
    sceneId?: string;
    characterId?: string;
    role?: string;
  }) => Promise<{ linked: boolean; linkId?: string; duplicate?: boolean }>;
  detachReference?: (input: { projectId: string; userId: string; linkId: string }) => Promise<{ detached: boolean }>;
  getStoryboard?: (input: { projectId: string; userId: string }) => Promise<{ storyboard: unknown; version: number | null }>;
  syncStoryboard?: (input: { projectId: string; userId: string }) => Promise<{ synced: boolean; version?: number; sceneCount: number }>;
  updateStoryboardScene?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    patch: Record<string, unknown>;
  }) => Promise<{ updated: boolean; version?: number; sceneId: string }>;
  reorderStoryboardScenes?: (input: {
    projectId: string;
    userId: string;
    sceneIds: string[];
  }) => Promise<{ reordered: boolean; version?: number }>;
  upsertCharacter?: (input: {
    projectId: string;
    userId: string;
    body: Record<string, unknown> & { name: string };
  }) => Promise<{ character: unknown; version: number }>;
  assignCharacterToScene?: (input: {
    projectId: string;
    userId: string;
    characterId: string;
    sceneId: string;
    characterVersion?: number;
  }) => Promise<Record<string, unknown>>;
  setSceneFrame?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    frame: "first" | "last";
    assetId: string;
    expectedRevision?: number;
  }) => Promise<{ sceneId: string; frame: string; assetId: string }>;
  requestApproval?: (input: {
    projectId: string;
    userId: string;
    conversationId: string;
    targetType: string;
    targetId: string;
    targetVersion: string;
    payload: Record<string, unknown>;
    title: string;
    description?: string;
  }) => Promise<void>;
  startProductionGraph?: (input: { projectId: string; userId: string; runId: string }) => Promise<{ enqueued: boolean }>;
  submitMockProviderJob?: (input: {
    projectId: string;
    userId: string;
    runId: string;
    toolName: string;
    operation: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }) => Promise<{ providerJobId: string; status: string }>;
  getScenePrompt?: (input: { projectId: string; userId: string; sceneId: string }) => Promise<Record<string, unknown>>;
  saveScenePrompt?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    bundle: Record<string, unknown>;
    changeNote?: string;
  }) => Promise<Record<string, unknown>>;
  listPromptVersions?: (input: { projectId: string; userId: string; sceneId: string }) => Promise<Record<string, unknown>>;
  comparePromptVersions?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    versionA: number;
    versionB: number;
  }) => Promise<Record<string, unknown>>;
  restorePromptVersion?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    version: number;
  }) => Promise<Record<string, unknown>>;
  getSceneModelSettings?: (input: { projectId: string; userId: string; sceneId: string }) => Promise<Record<string, unknown>>;
  validatePromptForModel?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    modelId: string;
    operation: string;
    parameters?: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  prepareScenePrompt?: (input: {
    projectId: string;
    userId: string;
    sceneId: string;
    focus: "image" | "video" | "both";
  }) => Promise<Record<string, unknown>>;
  getTimeline?: (input: { projectId: string; userId: string }) => Promise<Record<string, unknown>>;
  createTimelineFromStoryboard?: (input: {
    projectId: string;
    userId: string;
    preview: boolean;
  }) => Promise<Record<string, unknown>>;
  updateTimelineClip?: (input: {
    projectId: string;
    userId: string;
    clip: Record<string, unknown>;
    expectedRevision?: number;
  }) => Promise<Record<string, unknown>>;
  reorderTimelineClips?: (input: {
    projectId: string;
    userId: string;
    trackId: string;
    clipIds: string[];
    expectedRevision?: number;
  }) => Promise<Record<string, unknown>>;
  setClipDuration?: (input: {
    projectId: string;
    userId: string;
    clipId: string;
    durationMs: number;
    expectedRevision?: number;
  }) => Promise<Record<string, unknown>>;
  attachAudioTrack?: (input: {
    projectId: string;
    userId: string;
    assetId: string;
    trackType: "VOICEOVER" | "MUSIC" | "SFX";
    startTimeMs: number;
    durationMs: number;
    volume?: number;
    expectedRevision?: number;
  }) => Promise<Record<string, unknown>>;
  validateTimeline?: (input: { projectId: string; userId: string }) => Promise<Record<string, unknown>>;
  prepareTimelineAssembly?: (input: { projectId: string; userId: string }) => Promise<Record<string, unknown>>;
};

export type ToolRunContext = {
  env: AppEnv;
  storage: ProductionStoragePort;
  runId: string;
  projectId: string;
  userId: string;
  conversationId?: string;
  delegates?: ToolExecutionDelegates;
};

export class ToolExecutor {
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly schemas = new Map<string, z.ZodTypeAny>();

  constructor(private readonly env: AppEnv) {
    for (const tool of PHASE4_TOOLS) {
      this.schemas.set(tool.id, emptyInput);
    }
  }

  register(toolId: string, schema: z.ZodTypeAny, handler: ToolHandler) {
    this.schemas.set(toolId, schema);
    this.handlers.set(toolId, handler);
  }

  getTool(id: string): Phase4ToolDefinition | undefined {
    return PHASE4_TOOLS.find((t) => t.id === id);
  }

  async execute(
    toolId: string,
    input: unknown,
    ctx: ToolRunContext,
    opts: { idempotencyKey: string; timeoutMs?: number },
  ): Promise<Record<string, unknown>> {
    const tool = this.getTool(toolId);
    if (!tool || !tool.enabled) throw new Error(`Tool unavailable: ${toolId}`);
    assertMediaGenerationBlocked(this.env, toolId);
    this.assertSideEffectAllowed(tool.sideEffect);

    const existing = await ctx.storage.findToolExecution(ctx.runId, opts.idempotencyKey);
    if (existing?.status === "COMPLETED" && existing.output) {
      return existing.output;
    }

    const schema = this.schemas.get(toolId) ?? emptyInput;
    const parsed = schema.parse(input ?? {}) as Record<string, unknown>;
    const { randomUUID } = await import("node:crypto");
    const execId = existing?.id ?? randomUUID();

    await ctx.storage.saveToolExecution({
      id: execId,
      agentRunId: ctx.runId,
      toolName: toolId,
      sideEffect: tool.sideEffect,
      idempotencyKey: opts.idempotencyKey,
      status: "RUNNING",
      input: parsed,
    });
    await ctx.storage.emitEvent("agent.tool.started", { runId: ctx.runId, toolId, execId });

    try {
      const handler = this.handlers.get(toolId);
      if (!handler) throw new Error(`No handler registered for ${toolId}`);
      const output = await this.withTimeout(handler(parsed, ctx), opts.timeoutMs ?? 30_000);
      await ctx.storage.saveToolExecution({
        id: execId,
        agentRunId: ctx.runId,
        toolName: toolId,
        sideEffect: tool.sideEffect,
        idempotencyKey: opts.idempotencyKey,
        status: "COMPLETED",
        input: parsed,
        output,
      });
      await ctx.storage.emitEvent("agent.tool.completed", { runId: ctx.runId, toolId, execId });
      return output;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tool failed";
      await ctx.storage.saveToolExecution({
        id: execId,
        agentRunId: ctx.runId,
        toolName: toolId,
        sideEffect: tool.sideEffect,
        idempotencyKey: opts.idempotencyKey,
        status: "FAILED",
        input: parsed,
        errorCode: "TOOL_FAILED",
        errorMessage: message,
      });
      await ctx.storage.emitEvent("agent.tool.failed", { runId: ctx.runId, toolId, execId, message });
      throw e;
    }
  }

  private assertSideEffectAllowed(sideEffect: ToolSideEffectClass) {
    if (sideEffect === "EXTERNAL_PAID") {
      assertExternalProviderExecutionAllowed(this.env, "EXTERNAL_PAID");
    }
    if (sideEffect === "EXTERNAL_FREE") {
      assertExternalProviderExecutionAllowed(this.env, "EXTERNAL_FREE");
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Tool timeout")), ms)),
    ]);
  }
}
