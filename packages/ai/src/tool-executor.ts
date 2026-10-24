import type { AppEnv } from "@shotbro/config/env";
import { assertExternalProviderExecutionAllowed } from "@shotbro/config";
import { z } from "zod";
import type { ProductionStoragePort } from "./ports/production-storage.js";
import { PHASE4_TOOLS, type Phase4ToolDefinition } from "./agent/phase4-tool-catalog.js";
import type { ToolSideEffectClass } from "./tool-side-effects.js";

const emptyInput = z.object({}).strict();

export type ToolHandler = (input: Record<string, unknown>, ctx: ToolRunContext) => Promise<Record<string, unknown>>;

export type ToolExecutionDelegates = {
  listAssets?: (projectId: string, userId: string) => Promise<Array<{ id: string; mimeType: string; originalName?: string }>>;
  attachReference?: (input: { projectId: string; userId: string; assetId: string; sceneId?: string }) => Promise<{ linked: boolean }>;
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
