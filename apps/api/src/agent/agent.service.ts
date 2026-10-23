import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  buildMockBriefFromRequest,
  buildMockPlan,
  buildMockScript,
  buildMockStoryboard,
  assertProductionTransition,
} from "@shotbro/ai";
import type { AgentProductionState } from "@shotbro/contracts";
import { CreateAgentRunBodySchema } from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { agentRun, conversation, message, messageBlock, productionDocument, projectMemory } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";

@Injectable()
export class AgentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
  ) {}

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

    let conversationId = input.conversationId;
    if (!conversationId) {
      const convs = await this.db.select().from(conversation).where(eq(conversation.projectId, projectId)).limit(1);
      if (!convs[0]) throw new NotFoundException("No conversation for project");
      conversationId = convs[0].id;
    } else {
      const [conv] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
      if (!conv || conv.projectId !== projectId) throw new NotFoundException("Conversation not found");
    }

    const runId = uuid();
    const now = new Date();
    let state: AgentProductionState = "DRAFT";

    await this.db.insert(agentRun).values({
      id: runId,
      projectId,
      conversationId,
      status: "RUNNING",
      productionState: state,
      triggerMessage: input.userRequest,
      metadata: { phase: 3, mock: true },
      createdAt: now,
      updatedAt: now,
    });

    await this.events.append({
      workspaceId,
      projectId,
      type: "agent.run.started",
      resourceId: runId,
      payload: { runId, productionState: state },
    });

    state = await this.advanceMockPipeline(
      userId,
      workspaceId,
      projectId,
      runId,
      conversationId,
      input.userRequest,
      state,
    );

    const [finalRow] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    return this.toRunDto(finalRow!);
  }

  private async advanceMockPipeline(
    userId: string,
    workspaceId: string,
    projectId: string,
    runId: string,
    conversationId: string,
    userRequest: string,
    state: AgentProductionState,
  ): Promise<AgentProductionState> {
    const steps: { next: AgentProductionState; work: () => Promise<void> }[] = [
      {
        next: "BRIEFING",
        work: async () => {
          const brief = buildMockBriefFromRequest(userRequest);
          await this.saveDoc(userId, projectId, "BRIEF", brief);
          await this.ensureMemory(projectId);
        },
      },
      {
        next: "PLANNING",
        work: async () => {
          const brief = buildMockBriefFromRequest(userRequest);
          const plan = buildMockPlan(brief);
          await this.saveDoc(userId, projectId, "PRODUCTION_PLAN", plan);
        },
      },
      {
        next: "WAITING_PLAN_APPROVAL",
        work: async () => {
          await this.postAssistantBlocks(conversationId, projectId, [
            {
              type: "generation_plan",
              demo: true,
              title: "План производства (mock)",
              overallStatus: "completed",
              steps: [
                { id: "brief", label: "Brief", status: "completed" },
                { id: "plan", label: "Plan", status: "completed" },
              ],
            },
            { type: "text", markdown: "**Mock agent:** план готов. Утвердите план для сценария." },
          ]);
        },
      },
      {
        next: "SCRIPTING",
        work: async () => {
          const brief = buildMockBriefFromRequest(userRequest);
          const plan = buildMockPlan(brief);
          const script = buildMockScript(brief, plan);
          await this.saveDoc(userId, projectId, "SCRIPT", script);
        },
      },
      {
        next: "WAITING_SCRIPT_APPROVAL",
        work: async () => {
          const brief = buildMockBriefFromRequest(userRequest);
          const plan = buildMockPlan(brief);
          const script = buildMockScript(brief, plan);
          await this.postAssistantBlocks(conversationId, projectId, [
            {
              type: "script",
              demo: true,
              title: script.title,
              durationLabel: `${script.totalDurationSeconds}s`,
              scenes: script.scenes.map((s) => ({
                id: s.id,
                title: s.title,
                timeRange: `${s.durationSeconds}s`,
                description: s.description,
              })),
            },
            { type: "text", markdown: "**Mock agent:** сценарий готов (mock)." },
          ]);
        },
      },
      {
        next: "STORYBOARDING",
        work: async () => {
          const brief = buildMockBriefFromRequest(userRequest);
          const script = buildMockScript(brief, buildMockPlan(brief));
          const storyboard = buildMockStoryboard(script);
          await this.saveDoc(userId, projectId, "STORYBOARD", storyboard);
        },
      },
      {
        next: "WAITING_STORYBOARD_APPROVAL",
        work: async () => {
          const brief = buildMockBriefFromRequest(userRequest);
          const script = buildMockScript(brief, buildMockPlan(brief));
          const storyboard = buildMockStoryboard(script);
          await this.postAssistantBlocks(conversationId, projectId, [
            {
              type: "storyboard",
              demo: true,
              title: storyboard.title,
              scenes: storyboard.frames.map((f) => ({
                id: f.sceneId,
                title: `Scene ${f.sequence}`,
                thumbnailUrl: "/demo/storyboard-placeholder.jpg",
                status: "completed" as const,
                durationLabel: `${f.durationSeconds}s`,
              })),
            },
          ]);
        },
      },
      {
        next: "READY_FOR_PRODUCTION",
        work: async () => {},
      },
    ];

    for (const step of steps) {
      assertProductionTransition(state, step.next);
      state = step.next;
      await this.db
        .update(agentRun)
        .set({ productionState: state, updatedAt: new Date() })
        .where(eq(agentRun.id, runId));
      await this.events.append({
        workspaceId,
        projectId,
        type: "agent.run.updated",
        resourceId: runId,
        payload: { runId, productionState: state },
      });
      await step.work();
    }

    await this.db
      .update(agentRun)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(agentRun.id, runId));
    await this.events.append({
      workspaceId,
      projectId,
      type: "agent.run.completed",
      resourceId: runId,
      payload: { runId, productionState: state },
    });
    return state;
  }

  private async saveDoc(
    userId: string,
    projectId: string,
    docType: "BRIEF" | "PRODUCTION_PLAN" | "SCRIPT" | "STORYBOARD",
    payload: Record<string, unknown>,
  ) {
    await this.db.insert(productionDocument).values({
      id: uuid(),
      projectId,
      docType,
      version: 1,
      status: "ACTIVE",
      schemaVersion: 1,
      payload,
      createdBy: userId,
    });
  }

  private async ensureMemory(projectId: string) {
    const [existing] = await this.db.select().from(projectMemory).where(eq(projectMemory.projectId, projectId)).limit(1);
    if (existing) return;
    await this.db.insert(projectMemory).values({ projectId });
  }

  private async postAssistantBlocks(conversationId: string, projectId: string, blocks: Record<string, unknown>[]) {
    const messageId = uuid();
    await this.db.insert(message).values({
      id: messageId,
      conversationId,
      projectId,
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
