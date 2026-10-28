import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { AgentRuntime, CreativeAgentRuntime, ProductionOrchestrator } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { CreateAgentRunBodySchema, CreativeAgentTurnBodySchema } from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import {
  agentRun,
  approval,
  conversation,
  message,
  messageBlock,
  toolExecution,
  providerJob,
  project,
} from "@shotbro/db/schema";
import type { ProjectAgentSettings } from "./agent-runtime-rollout.service";
import { AgentRuntimeRolloutService } from "./agent-runtime-rollout.service";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { CostReservationService } from "../production/cost-reservation.service";
import { ProductionGraphService } from "../production/production-graph.service";
import { DrizzleProductionStorage } from "./drizzle-production-storage";
import { buildAgentToolDelegates } from "./agent-tool-delegates";
import type { AgentProductionState } from "@shotbro/contracts";
import { AssetsService } from "../assets/assets.service";
import { ProviderJobsService } from "../providers/provider-jobs.service";
import { StoryboardDocumentService } from "../production/storyboard-document.service";
import { ReferenceService } from "../production/reference.service";
import { CharacterContinuityService } from "../production/character-continuity.service";
import { PromptVersionService } from "../production/prompt-version.service";
import { TimelineDocumentService } from "../production/timeline-document.service";
import { IdempotencyService } from "../common/idempotency.service";

export function creativeTurnIdempotencyStorageKey(userId: string, projectId: string, clientKey: string) {
  return `creative-turn:${userId}:${projectId}:${clientKey}`;
}

const CREATIVE_TURN_ROUTE = "POST /api/v1/projects/:projectId/agent/creative-turn";

@Injectable()
export class AgentService {
  private readonly env = loadEnvFromProcess();
  private readonly orchestrator = new ProductionOrchestrator(this.env);
  private readonly agentRuntime = new AgentRuntime(this.env);
  private readonly creativeRuntime = new CreativeAgentRuntime(this.env);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
    @Inject(ApprovalsService) private readonly approvals: ApprovalsService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
    @Inject(CostReservationService) private readonly cost: CostReservationService,
    @Inject(AssetsService) private readonly assets: AssetsService,
    @Inject(ProviderJobsService) private readonly providerJobs: ProviderJobsService,
    @Inject(AgentRuntimeRolloutService) private readonly rollout: AgentRuntimeRolloutService,
    @Inject(StoryboardDocumentService) private readonly storyboard: StoryboardDocumentService,
    @Inject(ReferenceService) private readonly references: ReferenceService,
    @Inject(CharacterContinuityService) private readonly characters: CharacterContinuityService,
    @Inject(PromptVersionService) private readonly prompts: PromptVersionService,
    @Inject(TimelineDocumentService) private readonly timeline: TimelineDocumentService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  /** Storyboard document revision invalidates downstream gates; re-open STORYBOARD approval in chat. */
  async onStoryboardDocumentRevised(userId: string, projectId: string) {
    await this.approvals.expirePendingForTargetTypes(projectId, ["STORYBOARD", "COST", "PRODUCTION"]);
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const rewindFrom = new Set<AgentProductionState>([
      "WAITING_STORYBOARD_APPROVAL",
      "WAITING_COST_APPROVAL",
      "WAITING_PRODUCTION_APPROVAL",
      "READY_FOR_PRODUCTION",
    ]);
    const runs = await this.db
      .select()
      .from(agentRun)
      .where(and(eq(agentRun.projectId, projectId), eq(agentRun.status, "RUNNING")));
    for (const run of runs) {
      if (!rewindFrom.has(run.productionState as AgentProductionState)) continue;
      if (!run.conversationId) continue;
      await this.db
        .update(agentRun)
        .set({ productionState: "WAITING_STORYBOARD_APPROVAL", updatedAt: new Date() })
        .where(eq(agentRun.id, run.id));
      const storage = new DrizzleProductionStorage(this.db, workspaceId, this.events);
      await this.orchestrator.refreshWaitingGateRequest(
        run.id,
        userId,
        this.ports(storage, workspaceId, run.conversationId, userId, projectId),
      );
    }
  }

  async resumeAfterApproval(projectId: string, userId: string, targetType: string) {
    const stateByType: Record<string, AgentProductionState> = {
      PLAN: "WAITING_PLAN_APPROVAL",
      SCRIPT: "WAITING_SCRIPT_APPROVAL",
      STORYBOARD: "WAITING_STORYBOARD_APPROVAL",
      COST: "WAITING_COST_APPROVAL",
      PRODUCTION: "WAITING_PRODUCTION_APPROVAL",
    };
    const waiting = stateByType[targetType];
    if (!waiting) return;
    const runs = await this.db
      .select()
      .from(agentRun)
      .where(and(eq(agentRun.projectId, projectId), eq(agentRun.productionState, waiting)));
    for (const run of runs) {
      await this.resumeRun(userId, projectId, run.id);
    }
  }

  async handleApprovalRejected(projectId: string, targetType: string, userId?: string) {
    const stateByType: Record<string, AgentProductionState> = {
      PLAN: "WAITING_PLAN_APPROVAL",
      SCRIPT: "WAITING_SCRIPT_APPROVAL",
      STORYBOARD: "WAITING_STORYBOARD_APPROVAL",
      COST: "WAITING_COST_APPROVAL",
      PRODUCTION: "WAITING_PRODUCTION_APPROVAL",
    };
    const waiting = stateByType[targetType];
    if (!waiting) return;
    const runs = await this.db
      .select()
      .from(agentRun)
      .where(and(eq(agentRun.projectId, projectId), eq(agentRun.productionState, waiting)));
    for (const run of runs) {
      if (userId && (targetType === "COST" || targetType === "PRODUCTION")) {
        await this.cost.releaseHeldForRun(userId, run.id);
      }
    }
    await this.db
      .update(agentRun)
      .set({ status: "CANCELLED", productionState: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(agentRun.projectId, projectId), eq(agentRun.productionState, waiting)));
  }

  async handleApprovalRequiresRevision(projectId: string, targetType: string) {
    const stateByType: Record<string, AgentProductionState> = {
      PLAN: "WAITING_PLAN_APPROVAL",
      SCRIPT: "WAITING_SCRIPT_APPROVAL",
      STORYBOARD: "WAITING_STORYBOARD_APPROVAL",
      COST: "WAITING_COST_APPROVAL",
      PRODUCTION: "WAITING_PRODUCTION_APPROVAL",
    };
    const waiting = stateByType[targetType];
    if (!waiting) return;
    await this.db
      .update(agentRun)
      .set({ productionState: "NEEDS_REVISION", updatedAt: new Date() })
      .where(and(eq(agentRun.projectId, projectId), eq(agentRun.productionState, waiting)));
  }

  async listRuns(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = await this.db.select().from(agentRun).where(eq(agentRun.projectId, projectId));
    return { items: rows.map((r) => this.toRunDto(r)) };
  }

  async getRunTrace(userId: string, projectId: string, runId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [run] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!run || run.projectId !== projectId) throw new NotFoundException();
    const tools = await this.db.select().from(toolExecution).where(eq(toolExecution.agentRunId, runId));
    const jobs = await this.db.select().from(providerJob).where(eq(providerJob.runId, runId));
    const meta = (run.metadata ?? {}) as { traceId?: string; conversationId?: string };
    return {
      runId,
      projectId,
      conversationId: meta.conversationId ?? run.conversationId,
      traceId: meta.traceId,
      productionState: run.productionState,
      toolExecutions: tools.map((t) => ({
        id: t.id,
        toolName: t.toolName,
        status: t.status,
        sideEffect: t.sideEffect,
      })),
      providerJobs: jobs.map((j) => ({
        id: j.id,
        providerId: j.providerId,
        modelId: j.modelId,
        status: j.status,
        operation: j.operation,
      })),
      mock: true,
    };
  }

  async getRun(userId: string, projectId: string, runId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!row || row.projectId !== projectId) throw new NotFoundException("Agent run not found");
    return this.toRunDto(row);
  }

  /** Phase 5K / 5L-A: mock or live NL → creative tools (no production orchestrator). */
  async runCreativeTurn(userId: string, projectId: string, body: unknown) {
    const input = CreativeAgentTurnBodySchema.parse(body);
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.resolveConversation(projectId, input.conversationId);

    const storageKey = input.idempotencyKey
      ? creativeTurnIdempotencyStorageKey(userId, projectId, input.idempotencyKey)
      : undefined;

    return this.idempotency.runWithClaim(storageKey, userId, CREATIVE_TURN_ROUTE, () =>
      this.executeCreativeTurn(userId, projectId, input),
    );
  }

  private async executeCreativeTurn(
    userId: string,
    projectId: string,
    input: { conversationId: string; userMessage: string; idempotencyKey?: string },
  ) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);

    const runId = uuid();
    const now = new Date();
    await this.db.insert(agentRun).values({
      id: runId,
      projectId,
      conversationId: input.conversationId,
      status: "RUNNING",
      productionState: "DRAFT",
      triggerMessage: input.userMessage,
      metadata: {
        phase: "5K-creative",
        mockAgent: true,
        idempotencyKey: input.idempotencyKey,
      },
      createdAt: now,
      updatedAt: now,
    });

    const storage = new DrizzleProductionStorage(this.db, workspaceId, this.events);
    const delegates = buildAgentToolDelegates({
      assets: this.assets,
      approvals: this.approvals,
      graph: this.graph,
      providerJobs: this.providerJobs,
      references: this.references,
      storyboard: this.storyboard,
      characters: this.characters,
      prompts: this.prompts,
      timeline: this.timeline,
      conversationId: input.conversationId,
    });

    const [projRow] = await this.db.select().from(project).where(eq(project.id, projectId)).limit(1);
    const settings = (projRow?.settings ?? {}) as Record<string, unknown>;
    const mem = (settings.creativeAgentMemory ?? {}) as {
      assets?: Array<{ id: string; mimeType: string; originalName?: string; status?: string }>;
      scenes?: Array<{ sceneId: string; title?: string }>;
    };
    const memoryContext = this.creativeRuntime.buildMemoryContext({
      assets: mem.assets ?? [],
      scenes: mem.scenes ?? [],
    });

    const turn = await this.creativeRuntime.runCreativeTurn({
      runId,
      projectId,
      userId,
      userMessage: input.userMessage,
      storage,
      conversationId: input.conversationId,
      delegates,
      memoryContext,
      sessionSeed: { assets: mem.assets ?? [], scenes: mem.scenes ?? [] },
    });

    if (turn.status === "no_intent") {
      await this.db.delete(agentRun).where(eq(agentRun.id, runId));
      return { status: "no_intent", mockAgent: turn.mockAgent, results: [], assistantMessage: turn.assistantMessage };
    }

    const header = turn.llmLive
      ? turn.status === "completed"
        ? "**Creative Agent (OpenRouter LLM)** — инструменты выполнены в REAL проекте. Генерация фото/видео отключена."
        : `**Creative Agent (OpenRouter LLM)** — ${turn.error ?? "ошибка"}`
      : turn.status === "completed"
        ? "**Mock-планировщик Phase 5K** — инструменты выполнены (E2E/fallback)."
        : `**Mock-планировщик Phase 5K** — ${turn.error ?? "ошибка"}`;

    const usageLine =
      turn.llmLive && turn.usage
        ? `_LLM usage (OpenRouter): in=${turn.usage.inputTokens} out=${turn.usage.outputTokens} tokens_`
        : undefined;

    const blocks: Record<string, unknown>[] = [
      { type: "text", markdown: header },
      ...(usageLine ? [{ type: "text", markdown: usageLine }] : []),
      ...(turn.assistantMessage ? [{ type: "text", markdown: turn.assistantMessage }] : []),
      ...turn.results.map((r) => ({
        type: "agent_tool_result",
        mockAgent: turn.mockAgent,
        toolName: r.toolName,
        success: r.success,
        humanReadableSummary: r.humanReadableSummary,
        projectId: r.projectId,
        assetId: r.assetId,
        sceneId: r.sceneId,
        revision: r.revision,
        errorCode: r.errorCode,
        deepLink: r.deepLink,
      })),
    ];
    await this.postAssistantBlocks(input.conversationId, projectId, blocks);

    const storyboardTools = new Set([
      "set_scene_first_frame_by_ordinal",
      "set_scene_first_frame",
      "set_scene_last_frame",
      "update_storyboard_scene",
      "sync_storyboard_from_script",
      "reorder_storyboard_scenes",
    ]);
    if (turn.results.some((r) => r.success && storyboardTools.has(r.toolName))) {
      await this.onStoryboardDocumentRevised(userId, projectId);
    }

    const searchHit = turn.results.find((r) => r.toolName === "search_project_assets" && r.success);
    const items = (searchHit?.payload as { items?: typeof mem.assets } | undefined)?.items;
    const boardHit = turn.results.find((r) => r.toolName === "get_storyboard" && r.success);
    const boardScenes = (boardHit?.payload as { storyboard?: { scenes?: typeof mem.scenes } } | undefined)
      ?.storyboard?.scenes;
    if (items?.length || boardScenes?.length) {
      await this.db
        .update(project)
        .set({
          settings: {
            ...settings,
            creativeAgentMemory: {
              assets: items ?? mem.assets ?? [],
              scenes: boardScenes ?? mem.scenes ?? [],
              conversationId: input.conversationId,
              updatedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(project.id, projectId));
    }

    await this.db
      .update(agentRun)
      .set({
        status: turn.status === "completed" ? "COMPLETED" : "FAILED",
        updatedAt: new Date(),
        metadata: {
          phase: "5K-creative",
          mockAgent: turn.mockAgent,
          llmLive: turn.llmLive ?? false,
          toolResults: turn.results.length,
          usage: turn.usage,
          error: turn.error,
        },
      })
      .where(eq(agentRun.id, runId));

    return { runId, ...turn };
  }

  async createRun(userId: string, projectId: string, body: unknown) {
    const input = CreateAgentRunBodySchema.parse(body);
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const conversationId = await this.resolveConversation(projectId, input.conversationId);
    const [projRow] = await this.db.select().from(project).where(eq(project.id, projectId)).limit(1);
    const projectSettings = (projRow?.settings ?? {}) as ProjectAgentSettings;
    const runtimeVersion = this.rollout.resolveRuntimeVersion(projectSettings);

    const runId = uuid();
    const traceId = uuid();
    const now = new Date();
    await this.db.insert(agentRun).values({
      id: runId,
      projectId,
      conversationId,
      status: "RUNNING",
      productionState: "DRAFT",
      triggerMessage: input.userRequest,
      metadata: {
        phase: runtimeVersion,
        runtimeVersion,
        mock: true,
        traceId,
        conversationId,
        projectId,
      },
      createdAt: now,
      updatedAt: now,
    });

    const storage = new DrizzleProductionStorage(this.db, workspaceId, this.events);
    await storage.emitEvent("agent.run.started", { runId, projectId, productionState: "DRAFT" }, runId);

    if (runtimeVersion === 4) {
      const delegates = buildAgentToolDelegates({
        assets: this.assets,
        approvals: this.approvals,
        graph: this.graph,
        providerJobs: this.providerJobs,
        references: this.references,
        storyboard: this.storyboard,
        characters: this.characters,
        prompts: this.prompts,
        timeline: this.timeline,
        conversationId,
      });
      await this.postAssistantBlocks(conversationId, projectId, [
        {
          type: "agent_activity",
          demo: true,
          label: "AgentRuntime · mock LLM planning",
          status: "running",
          simulationLabel: "MOCK · Phase 4",
          runId,
          traceId,
          goal: "Structured plan and tools before production orchestrator",
        },
        {
          type: "production_progress",
          demo: true,
          runId,
          traceId,
          stage: "Agent planning",
          percent: 15,
          message: "Context builder + mock LLM gateway",
        },
      ]);
      await this.agentRuntime.runTurn({
        runId,
        projectId,
        userId,
        userMessage: input.userRequest,
        storage,
        conversationId,
        delegates,
      });
    }

    const state = await this.orchestrator.advance(
      runId,
      userId,
      this.ports(storage, workspaceId, conversationId, userId, projectId),
    );
    const [finalRow] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    return { ...this.toRunDto(finalRow!), productionState: state };
  }

  async resumeRun(userId: string, projectId: string, runId: string) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!row || row.projectId !== projectId) throw new NotFoundException();
    if (row.status === "CANCELLED") throw new ConflictException("Run cancelled");
    const storage = new DrizzleProductionStorage(this.db, workspaceId, this.events);
    const state = await this.orchestrator.advance(
      runId,
      userId,
      this.ports(storage, workspaceId, row.conversationId!, userId, projectId),
    );
    return this.getRun(userId, projectId, runId);
  }

  async pauseRun(userId: string, projectId: string, runId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.db
      .update(agentRun)
      .set({ status: "RUNNING", productionState: "PAUSED", updatedAt: new Date() })
      .where(eq(agentRun.id, runId));
    return this.getRun(userId, projectId, runId);
  }

  async cancelRun(userId: string, projectId: string, runId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.cost.releaseHeldForRun(userId, runId);
    await this.db
      .update(agentRun)
      .set({ status: "CANCELLED", productionState: "CANCELLED", updatedAt: new Date() })
      .where(eq(agentRun.id, runId));
    return this.getRun(userId, projectId, runId);
  }

  private ports(
    storage: DrizzleProductionStorage,
    workspaceId: string,
    conversationId: string,
    userId: string,
    projectId: string,
  ) {
    return {
      storage,
      approvals: {
        request: async (input: {
          projectId: string;
          conversationId: string;
          userId: string;
          targetType: string;
          targetId: string;
          targetVersion: string;
          payload: Record<string, unknown>;
          title: string;
          description?: string;
        }) => {
          await this.approvals.create(input.userId, input.projectId, {
            conversationId: input.conversationId,
            title: input.title,
            description: input.description,
            targetType: input.targetType,
            targetId: input.targetId,
            targetVersion: input.targetVersion,
            payload: input.payload,
          });
        },
        isApproved: async (projectId: string, targetType: string, targetId: string, targetVersion: string) => {
          const [row] = await this.db
            .select()
            .from(approval)
            .where(
              and(
                eq(approval.projectId, projectId),
                eq(approval.targetType, targetType),
                eq(approval.targetId, targetId),
                eq(approval.targetVersion, targetVersion),
                eq(approval.status, "APPROVED"),
              ),
            )
            .limit(1);
          return Boolean(row);
        },
      },
      onChatBlocks: async (blocks: Record<string, unknown>[]) => {
        await this.postAssistantBlocks(conversationId, projectId, blocks);
      },
      onReserveCost: async (input: {
        runId: string;
        projectId: string;
        userId: string;
        amountUsd: number;
        estimateVersion: string;
      }) => {
        await this.cost.reserve(input.userId, input.projectId, {
          amountUsd: input.amountUsd,
          idempotencyKey: `cost:${input.runId}:v${input.estimateVersion}`,
          agentRunId: input.runId,
          reason: "mock_production_estimate",
        });
      },
      onEnsureTimeline: async (input: { projectId: string; userId: string }) => {
        await this.timeline.ensureTimeline(input.userId, input.projectId);
      },
      onStartProduction: async (input: { runId: string; projectId: string; userId: string }) => {
        const [runRow] = await this.db.select().from(agentRun).where(eq(agentRun.id, input.runId)).limit(1);
        const meta = (runRow?.metadata ?? {}) as { productionEnqueued?: boolean; traceId?: string };
        if (meta.productionEnqueued) return;
        await this.timeline.ensureTimelineForProduction(input.userId, input.projectId);
        await this.graph.startProductionRun(input.userId, input.projectId, input.runId);
        const [afterStart] = await this.db.select().from(agentRun).where(eq(agentRun.id, input.runId)).limit(1);
        const merged = (afterStart?.metadata ?? meta) as Record<string, unknown>;
        await this.db
          .update(agentRun)
          .set({
            metadata: { ...merged, productionEnqueued: true, mock: true },
            updatedAt: new Date(),
          })
          .where(eq(agentRun.id, input.runId));
        await this.postAssistantBlocks(conversationId, projectId, [
          {
            type: "agent_activity",
            demo: true,
            label: "Mock-производство запущено",
            status: "running",
            simulationLabel: "MOCK · локальные fixtures",
            runId: input.runId,
            traceId: meta.traceId,
          },
          {
            type: "production_progress",
            demo: true,
            runId: input.runId,
            traceId: meta.traceId,
            stage: "Mock production graph",
            percent: 55,
            message: "Provider jobs + FFmpeg assembly (mock)",
          },
        ]);
      },
    };
  }

  private async resolveConversation(projectId: string, conversationId?: string) {
    if (conversationId) {
      const [conv] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
      if (!conv || conv.projectId !== projectId) throw new NotFoundException("Conversation not found");
      return conversationId;
    }
    const convs = await this.db.select().from(conversation).where(eq(conversation.projectId, projectId)).limit(1);
    if (!convs[0]) throw new NotFoundException("No conversation for project");
    return convs[0].id;
  }

  private async postAssistantBlocks(conversationId: string, projectId: string, blocks: Record<string, unknown>[]) {
    const [conv] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
    if (!conv) return;
    const [projRow] = await this.db.select().from(project).where(eq(project.id, projectId)).limit(1);
    const messageId = uuid();
    await this.db.insert(message).values({
      id: messageId,
      conversationId,
      projectId: conv.projectId,
      role: "assistant",
      content: "Agent update",
    });
    for (const [idx, payload] of blocks.entries()) {
      await this.db.insert(messageBlock).values({
        id: uuid(),
        messageId,
        position: idx,
        type: String(payload.type),
        payload,
      });
    }
    if (projRow) {
      await this.events.append({
        workspaceId: projRow.workspaceId,
        projectId,
        type: "message.created",
        resourceId: messageId,
        payload: { messageId, conversationId, projectId, blockTypes: blocks.map((b) => b.type) },
      });
    }
  }

  private toRunDto(row: typeof agentRun.$inferSelect) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      projectId: row.projectId,
      conversationId: row.conversationId,
      status: row.status,
      productionState: row.productionState,
      metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
