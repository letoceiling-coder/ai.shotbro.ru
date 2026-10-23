import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { ProductionOrchestrator } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { CreateAgentRunBodySchema } from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { agentRun, approval, conversation, message, messageBlock } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { CostReservationService } from "../production/cost-reservation.service";
import { ProductionGraphService } from "../production/production-graph.service";
import { DrizzleProductionStorage } from "./drizzle-production-storage";
import type { AgentProductionState } from "@shotbro/contracts";

@Injectable()
export class AgentService {
  private readonly orchestrator = new ProductionOrchestrator(loadEnvFromProcess());

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
    @Inject(ApprovalsService) private readonly approvals: ApprovalsService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
    @Inject(CostReservationService) private readonly cost: CostReservationService,
  ) {}

  async resumeAfterApproval(projectId: string, userId: string, targetType: string) {
    const stateByType: Record<string, AgentProductionState> = {
      PLAN: "WAITING_PLAN_APPROVAL",
      SCRIPT: "WAITING_SCRIPT_APPROVAL",
      STORYBOARD: "WAITING_STORYBOARD_APPROVAL",
      COST: "WAITING_COST_APPROVAL",
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

  async handleApprovalRejected(projectId: string, targetType: string) {
    const stateByType: Record<string, AgentProductionState> = {
      PLAN: "WAITING_PLAN_APPROVAL",
      SCRIPT: "WAITING_SCRIPT_APPROVAL",
      STORYBOARD: "WAITING_STORYBOARD_APPROVAL",
      COST: "WAITING_COST_APPROVAL",
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

  async getRun(userId: string, projectId: string, runId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!row || row.projectId !== projectId) throw new NotFoundException("Agent run not found");
    return this.toRunDto(row);
  }

  async createRun(userId: string, projectId: string, body: unknown) {
    const input = CreateAgentRunBodySchema.parse(body);
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const conversationId = await this.resolveConversation(projectId, input.conversationId);

    const runId = uuid();
    const now = new Date();
    await this.db.insert(agentRun).values({
      id: runId,
      projectId,
      conversationId,
      status: "RUNNING",
      productionState: "DRAFT",
      triggerMessage: input.userRequest,
      metadata: { phase: 3, mock: true },
      createdAt: now,
      updatedAt: now,
    });

    const storage = new DrizzleProductionStorage(this.db, workspaceId, this.events);
    await storage.emitEvent("agent.run.started", { runId, projectId, productionState: "DRAFT" }, runId);

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
      onReserveCost: async (input: { runId: string; projectId: string; userId: string; amountUsd: number }) => {
        await this.cost.reserve(input.userId, input.projectId, {
          amountUsd: input.amountUsd,
          idempotencyKey: `cost:${input.runId}:v1`,
          agentRunId: input.runId,
          reason: "mock_production_estimate",
        });
      },
      onStartProduction: async (input: { runId: string; projectId: string; userId: string }) => {
        await this.graph.startProductionRun(input.userId, input.projectId, input.runId);
        await this.postAssistantBlocks(conversationId, projectId, [
          {
            type: "agent_activity",
            demo: true,
            label: "Mock-производство запущено",
            status: "running",
            simulationLabel: "MOCK · локальные fixtures",
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
  }

  private toRunDto(row: typeof agentRun.$inferSelect) {
    return {
      id: row.id,
      projectId: row.projectId,
      conversationId: row.conversationId,
      status: row.status,
      productionState: row.productionState,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
