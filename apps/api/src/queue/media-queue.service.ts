import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { loadApiEnv } from "../env";

export const MEDIA_METADATA_QUEUE = "media.metadata";
export const MEDIA_THUMBNAIL_QUEUE = "media.thumbnail";
export const MEDIA_POSTER_QUEUE = "media.poster";
export const MEDIA_CLEANUP_QUEUE = "media.cleanup";
export const STORAGE_RECONCILE_QUEUE = "storage.reconcile";
export const PRODUCTION_NODE_QUEUE = "production.node";
export const PRODUCTION_RUN_QUEUE = "production.run";

@Injectable()
export class MediaQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly connection: Redis;
  readonly metadata: Queue;
  readonly thumbnail: Queue;
  readonly poster: Queue;
  readonly cleanup: Queue;
  readonly reconcile: Queue;
  readonly productionNode: Queue;
  readonly productionRun: Queue;

  constructor() {
    const env = loadApiEnv();
    this.connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const defaultJob = { removeOnComplete: 100, removeOnFail: 500, attempts: 3, backoff: { type: "exponential" as const, delay: 2000 } };
    this.metadata = new Queue(MEDIA_METADATA_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.thumbnail = new Queue(MEDIA_THUMBNAIL_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.poster = new Queue(MEDIA_POSTER_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.cleanup = new Queue(MEDIA_CLEANUP_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.reconcile = new Queue(STORAGE_RECONCILE_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.productionNode = new Queue(PRODUCTION_NODE_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.productionRun = new Queue(PRODUCTION_RUN_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
  }

  async enqueueProductionRun(input: {
    runId: string;
    projectId: string;
    ownerId: string;
    workspaceId: string;
    timelineDocumentId?: string;
    timelineVersion?: number;
    timelineHash?: string;
  }): Promise<boolean> {
    const jobId = `production-run-${input.runId}`;
    const existing = await this.productionRun.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "active" || state === "waiting" || state === "delayed") {
        return false;
      }
    }
    try {
      await this.productionRun.add("execute", input, { jobId });
      return true;
    } catch {
      return false;
    }
  }

  async enqueueProductionNode(nodeId: string, projectId: string, runId: string, nodeType: string) {
    await this.productionNode.add(
      "execute",
      { nodeId, projectId, runId, nodeType, mock: true },
      { jobId: `prod-${nodeId}` },
    );
  }

  async onModuleInit() {
    try {
      await this.cleanup.add("sweep", {}, { repeat: { every: 15 * 60_000 }, jobId: "media-cleanup-repeat" });
      await this.reconcile.add("scan", {}, { repeat: { every: 6 * 60 * 60_000 }, jobId: "storage-reconcile-repeat" });
    } catch {
      /* repeatable jobs may already exist after API restart */
    }
  }

  async enqueueMediaProcessing(assetId: string) {
    await this.metadata.add("process", { assetId }, { jobId: `meta-${assetId}` });
  }

  async onModuleDestroy() {
    await Promise.all([
      this.metadata.close(),
      this.thumbnail.close(),
      this.poster.close(),
      this.cleanup.close(),
      this.reconcile.close(),
      this.productionNode.close(),
      this.productionRun.close(),
      this.connection.quit(),
    ]);
  }
}
