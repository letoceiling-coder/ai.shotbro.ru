import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { Phase4MockElevenLabsProvider, Phase4MockImageProvider, Phase4MockVideoProvider } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { providerJob } from "@shotbro/db/schema";
import { eq } from "drizzle-orm";
import { project } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionAssetIngestionService } from "../production/production-asset-ingestion.service";
import { DrizzleProviderJobStore } from "./drizzle-provider-job.store";
import { ProviderJobRuntimeService } from "./provider-job-runtime.service";
import { mockProviderOutputBytes } from "./provider-mock-output";

@Injectable()
export class ProviderJobsService {
  private readonly image = new Phase4MockImageProvider();
  private readonly video = new Phase4MockVideoProvider();
  private readonly audio = new Phase4MockElevenLabsProvider();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProductionAssetIngestionService) private readonly ingestion: ProductionAssetIngestionService,
    @Inject(ProviderJobRuntimeService) private readonly runtime: ProviderJobRuntimeService,
  ) {}

  private manager() {
    return this.runtime.createManager();
  }

  async listForProject(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const store = new DrizzleProviderJobStore(this.db);
    const items = await store.listByProject(projectId, 50);
    return { items, mock: true };
  }

  async submitMockFromTool(input: {
    userId: string;
    projectId: string;
    runId: string;
    toolName: string;
    operation: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }) {
    await this.access.assertProjectAccess(this.db, input.userId, input.projectId);
    const manager = this.manager();
    const adapter =
      input.toolName === "generate.image"
        ? this.image
        : input.toolName === "generate.video"
          ? this.video
          : this.audio;
    const job = await manager.submitWithAdapter(adapter, {
      id: uuid(),
      projectId: input.projectId,
      runId: input.runId,
      providerId: adapter.providerId,
      modelId: `mock/${adapter.modality}`,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      input: input.payload,
      userId: input.userId,
    });
    const store = new DrizzleProviderJobStore(this.db);
    const inserted = await store.get(job.id);
    if (inserted) {
      await store.update(job.id, {
        metadata: { ...(inserted.metadata ?? {}), toolInput: input.payload },
        expectedVersion: inserted.version,
        version: inserted.version + 1,
        updatedAt: new Date(),
      });
    }
    await this.ingestMockOutputsIfNeeded(await store.get(job.id));
    const fresh = await new DrizzleProviderJobStore(this.db).get(job.id);
    return { providerJobId: job.id, status: fresh?.status ?? job.status };
  }

  async applyWebhookEvent(
    providerId: string,
    event: { eventId: string; providerJobId: string; status: "COMPLETED" | "FAILED" | "RUNNING"; timestamp: number },
  ): Promise<boolean> {
    const store = new DrizzleProviderJobStore(this.db);
    const job = await store.get(event.providerJobId);
    if (!job || job.providerId !== providerId) return false;
    const appended = await store.appendEvent({
      id: event.eventId,
      providerJobId: job.id,
      eventType: "webhook",
      payload: { status: event.status, timestamp: event.timestamp },
      idempotencyKey: event.eventId,
    });
    if (!appended) return false;
    const manager = this.runtime.createManager();
    if (event.status === "RUNNING") await manager.transition(job.id, "RUNNING");
    if (event.status === "COMPLETED") {
      if (job.status !== "COMPLETED") {
        if (job.status === "SUBMITTED" || job.status === "QUEUED") await manager.transition(job.id, "RUNNING");
        await manager.transition(job.id, "COMPLETED");
        await this.ingestMockOutputsIfNeeded(await store.get(job.id));
      }
    }
    if (event.status === "FAILED") await manager.transition(job.id, "FAILED");
    return true;
  }

  /** Persist mock provider bytes to MinIO when job reached COMPLETED without assets. */
  async ingestMockOutputsIfNeeded(job: Awaited<ReturnType<DrizzleProviderJobStore["get"]>>) {
    if (!job || job.status !== "COMPLETED") return;
    const existing = job.outputAssetIds ?? [];
    if (existing.length > 0) return;
    const userId = String((job.metadata as { userId?: string })?.userId ?? "");
    if (!userId) return;
    const [proj] = await this.db.select().from(project).where(eq(project.id, job.projectId)).limit(1);
    if (!proj) return;
    const out = mockProviderOutputBytes(job.providerId);
    const rawInput = ((job.metadata as { toolInput?: Record<string, unknown> } | undefined)?.toolInput ??
      {}) as Record<string, unknown>;
    const parentAssetIds: string[] = [];
    for (const key of ["firstFrameAssetId", "lastFrameAssetId", "image", "sourceAssetId"] as const) {
      const v = rawInput[key];
      if (typeof v === "string" && v.length > 0) parentAssetIds.push(v);
    }
    if (Array.isArray(rawInput.referenceAssetIds)) {
      for (const id of rawInput.referenceAssetIds) {
        if (typeof id === "string" && id.length > 0) parentAssetIds.push(id);
      }
    }
    const ingested = await this.ingestion.ingestMockProviderOutput({
      userId,
      projectId: job.projectId,
      workspaceId: proj.workspaceId,
      sourceUrl: `https://fixtures.shotbro.test/mock/${job.id}`,
      bytes: out.bytes,
      mimeType: out.mimeType,
      originalName: out.originalName,
      providerJobId: job.id,
      graphNodeId: job.graphNodeId ?? undefined,
      parentAssetIds: [...new Set(parentAssetIds)],
    });
    const store = new DrizzleProviderJobStore(this.db);
    await store.update(job.id, {
      outputAssetIds: [ingested.assetId],
      expectedVersion: job.version,
      version: job.version + 1,
      updatedAt: new Date(),
    });
  }

  async getJobForProject(userId: string, projectId: string, jobId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db
      .select()
      .from(providerJob)
      .where(eq(providerJob.id, jobId))
      .limit(1);
    if (!row || row.projectId !== projectId) return null;
    return row;
  }
}
