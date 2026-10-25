import { and, desc, eq } from "drizzle-orm";
import type { ProviderJobRow, ProviderJobStore } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { providerExecutionAttempt, providerJob, providerJobEvent } from "@shotbro/db/schema";

export class DrizzleProviderJobStore implements ProviderJobStore {
  constructor(private readonly db: Db) {}

  async findByIdempotency(projectId: string, key: string): Promise<ProviderJobRow | null> {
    const [row] = await this.db
      .select()
      .from(providerJob)
      .where(and(eq(providerJob.projectId, projectId), eq(providerJob.idempotencyKey, key)))
      .limit(1);
    return row ? this.map(row) : null;
  }

  async get(id: string): Promise<ProviderJobRow | null> {
    const [row] = await this.db.select().from(providerJob).where(eq(providerJob.id, id)).limit(1);
    return row ? this.map(row) : null;
  }

  async insert(job: ProviderJobRow): Promise<void> {
    await this.db.insert(providerJob).values({
      id: job.id,
      projectId: job.projectId,
      runId: job.runId ?? null,
      sceneId: job.sceneId ?? null,
      graphNodeId: job.graphNodeId ?? null,
      providerId: job.providerId,
      modelId: job.modelId,
      operation: job.operation,
      status: job.status,
      providerJobId: job.providerJobId ?? null,
      inputHash: job.inputHash ?? null,
      idempotencyKey: job.idempotencyKey ?? null,
      attemptCount: job.attemptCount,
      version: job.version,
      submittedAt: job.submittedAt ?? null,
      startedAt: job.startedAt ?? null,
      completedAt: job.completedAt ?? null,
      failedAt: job.failedAt ?? null,
      outputAssetIds: job.outputAssetIds,
      estimatedCost: job.estimatedCost ?? null,
      actualUsage: job.actualUsage ?? null,
      failureCode: job.failureCode ?? null,
      metadata: job.metadata ?? {},
      logicalOperationId: job.logicalOperationId ?? null,
      routePlanVersion: job.routePlanVersion ?? 1,
      routeMetadata: job.routeMetadata ?? {},
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  }

  async update(
    id: string,
    patch: Partial<ProviderJobRow> & { expectedVersion?: number },
  ): Promise<ProviderJobRow | null> {
    const current = await this.get(id);
    if (!current) return null;
    if (patch.expectedVersion != null && patch.expectedVersion !== current.version) return null;
    const nextVersion = current.version + 1;
    await this.db
      .update(providerJob)
      .set({
        status: patch.status ?? current.status,
        providerJobId: patch.providerJobId ?? current.providerJobId,
        attemptCount: patch.attemptCount ?? current.attemptCount,
        version: nextVersion,
        submittedAt: patch.submittedAt ?? current.submittedAt,
        startedAt: patch.startedAt ?? current.startedAt,
        completedAt: patch.completedAt ?? current.completedAt,
        failedAt: patch.failedAt ?? current.failedAt,
        outputAssetIds: patch.outputAssetIds ?? current.outputAssetIds,
        actualUsage: patch.actualUsage ?? current.actualUsage,
        failureCode: patch.failureCode ?? current.failureCode,
        metadata: patch.metadata ?? current.metadata,
        logicalOperationId: patch.logicalOperationId ?? current.logicalOperationId,
        routePlanVersion: patch.routePlanVersion ?? current.routePlanVersion,
        routeMetadata: patch.routeMetadata ?? current.routeMetadata,
        updatedAt: patch.updatedAt ?? new Date(),
      })
      .where(and(eq(providerJob.id, id), eq(providerJob.version, current.version)));
    return this.get(id);
  }

  async appendEvent(input: {
    id: string;
    providerJobId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<boolean> {
    try {
      await this.db.insert(providerJobEvent).values({
        id: input.id,
        providerJobId: input.providerJobId,
        eventType: input.eventType,
        payload: input.payload ?? {},
        idempotencyKey: input.idempotencyKey ?? null,
      });
      return true;
    } catch {
      return false;
    }
  }

  async appendAttempt(input: {
    id: string;
    providerJobId: string;
    attemptNumber: number;
    status: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    completedAt?: Date;
  }): Promise<void> {
    await this.db.insert(providerExecutionAttempt).values({
      id: input.id,
      providerJobId: input.providerJobId,
      attemptNumber: input.attemptNumber,
      status: input.status,
      requestPayload: input.requestPayload,
      responsePayload: input.responsePayload,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      completedAt: input.completedAt ?? null,
    });
  }

  async listByProject(projectId: string, limit = 50): Promise<ProviderJobRow[]> {
    const rows = await this.db
      .select()
      .from(providerJob)
      .where(eq(providerJob.projectId, projectId))
      .orderBy(desc(providerJob.createdAt))
      .limit(limit);
    return rows.map((r) => this.map(r));
  }

  private map(row: typeof providerJob.$inferSelect): ProviderJobRow {
    return {
      id: row.id,
      projectId: row.projectId,
      runId: row.runId,
      sceneId: row.sceneId,
      graphNodeId: row.graphNodeId,
      providerId: row.providerId,
      modelId: row.modelId,
      operation: row.operation,
      status: row.status,
      providerJobId: row.providerJobId,
      inputHash: row.inputHash,
      idempotencyKey: row.idempotencyKey,
      attemptCount: row.attemptCount,
      version: row.version,
      submittedAt: row.submittedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
      outputAssetIds: (row.outputAssetIds as string[]) ?? [],
      estimatedCost: row.estimatedCost,
      actualUsage: row.actualUsage ?? undefined,
      failureCode: row.failureCode,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      logicalOperationId: row.logicalOperationId,
      routePlanVersion: row.routePlanVersion,
      routeMetadata: (row.routeMetadata as Record<string, unknown>) ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
