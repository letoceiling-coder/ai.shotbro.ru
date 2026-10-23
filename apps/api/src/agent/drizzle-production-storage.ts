import { and, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { AgentProductionState } from "@shotbro/contracts";
import type { ProductionStoragePort, StoredDocument, ToolExecutionRecord } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { agentRun, productionDocument, toolExecution } from "@shotbro/db/schema";
import type { EventLogService } from "../events/event-log.service";

export class DrizzleProductionStorage implements ProductionStoragePort {
  constructor(
    private readonly db: Db,
    private readonly workspaceId: string,
    private readonly events: EventLogService,
  ) {}

  async getRun(runId: string) {
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      conversationId: row.conversationId,
      productionState: row.productionState as AgentProductionState,
      status: row.status,
      triggerMessage: row.triggerMessage,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    };
  }

  async updateRunState(
    runId: string,
    patch: { productionState?: AgentProductionState; status?: string; metadata?: Record<string, unknown> },
  ) {
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!row) return;
    await this.db
      .update(agentRun)
      .set({
        productionState: patch.productionState ?? row.productionState,
        status: (patch.status as typeof row.status) ?? row.status,
        metadata: patch.metadata ?? row.metadata,
        updatedAt: new Date(),
      })
      .where(eq(agentRun.id, runId));
  }

  async saveDocument(input: {
    projectId: string;
    docType: string;
    payload: Record<string, unknown>;
    userId: string;
    supersedePrevious?: boolean;
  }): Promise<StoredDocument> {
    if (input.supersedePrevious !== false) {
      const existing = await this.db
        .select()
        .from(productionDocument)
        .where(and(eq(productionDocument.projectId, input.projectId), eq(productionDocument.docType, input.docType as never)))
        .orderBy(desc(productionDocument.version))
        .limit(1);
      if (existing[0]?.status === "ACTIVE") {
        await this.db
          .update(productionDocument)
          .set({ status: "SUPERSEDED", updatedAt: new Date() })
          .where(eq(productionDocument.id, existing[0].id));
      }
    }
    const version = (
      await this.db
        .select()
        .from(productionDocument)
        .where(and(eq(productionDocument.projectId, input.projectId), eq(productionDocument.docType, input.docType as never)))
        .orderBy(desc(productionDocument.version))
        .limit(1)
    )[0]?.version;
    const nextVersion = (version ?? 0) + 1;
    const id = uuid();
    await this.db.insert(productionDocument).values({
      id,
      projectId: input.projectId,
      docType: input.docType as never,
      version: nextVersion,
      status: "ACTIVE",
      schemaVersion: 1,
      payload: input.payload,
      createdBy: input.userId,
    });
    return { id, docType: input.docType, version: nextVersion, payload: input.payload };
  }

  async getActiveDocument(projectId: string, docType: string): Promise<StoredDocument | null> {
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(
          eq(productionDocument.projectId, projectId),
          eq(productionDocument.docType, docType as never),
          eq(productionDocument.status, "ACTIVE"),
        ),
      )
      .orderBy(desc(productionDocument.version))
      .limit(1);
    if (!row) return null;
    return { id: row.id, docType: row.docType, version: row.version, payload: row.payload as Record<string, unknown> };
  }

  async findToolExecution(agentRunId: string, idempotencyKey: string): Promise<ToolExecutionRecord | null> {
    const [row] = await this.db
      .select()
      .from(toolExecution)
      .where(and(eq(toolExecution.agentRunId, agentRunId), eq(toolExecution.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      toolName: row.toolName,
      idempotencyKey: row.idempotencyKey ?? undefined,
      status: row.status,
      output: row.output as Record<string, unknown> | undefined,
    };
  }

  async saveToolExecution(input: {
    id: string;
    agentRunId: string;
    toolName: string;
    sideEffect: string;
    idempotencyKey: string;
    status: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }) {
    const [existing] = await this.db.select().from(toolExecution).where(eq(toolExecution.id, input.id)).limit(1);
    if (existing) {
      await this.db
        .update(toolExecution)
        .set({
          status: input.status as never,
          output: input.output,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          completedAt: input.status === "COMPLETED" || input.status === "FAILED" ? new Date() : null,
        })
        .where(eq(toolExecution.id, input.id));
      return;
    }
    await this.db.insert(toolExecution).values({
      id: input.id,
      agentRunId: input.agentRunId,
      toolName: input.toolName,
      sideEffect: input.sideEffect,
      idempotencyKey: input.idempotencyKey,
      status: input.status as never,
      input: input.input,
      output: input.output,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      completedAt: input.status === "COMPLETED" || input.status === "FAILED" ? new Date() : null,
    });
  }

  async emitEvent(type: string, payload: Record<string, unknown>, resourceId?: string) {
    const projectId = String(payload.projectId ?? payload.runId ?? "");
    const run = payload.runId ? await this.getRun(String(payload.runId)) : null;
    const pid = run?.projectId ?? projectId;
    if (!pid) return;
    await this.events.append({
      workspaceId: this.workspaceId,
      projectId: pid,
      type,
      resourceId: resourceId ?? (payload.runId as string | undefined),
      payload,
    });
  }
}
