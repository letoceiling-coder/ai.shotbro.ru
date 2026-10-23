import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { loadApiEnv } from "../env";

export const MEDIA_METADATA_QUEUE = "media.metadata";
export const MEDIA_THUMBNAIL_QUEUE = "media.thumbnail";
export const MEDIA_POSTER_QUEUE = "media.poster";
export const MEDIA_CLEANUP_QUEUE = "media.cleanup";

@Injectable()
export class MediaQueueService implements OnModuleDestroy {
  private readonly connection: Redis;
  readonly metadata: Queue;
  readonly thumbnail: Queue;
  readonly poster: Queue;
  readonly cleanup: Queue;

  constructor() {
    const env = loadApiEnv();
    this.connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const defaultJob = { removeOnComplete: 100, removeOnFail: 500, attempts: 3, backoff: { type: "exponential" as const, delay: 2000 } };
    this.metadata = new Queue(MEDIA_METADATA_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.thumbnail = new Queue(MEDIA_THUMBNAIL_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.poster = new Queue(MEDIA_POSTER_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
    this.cleanup = new Queue(MEDIA_CLEANUP_QUEUE, { connection: this.connection, defaultJobOptions: defaultJob });
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
      this.connection.quit(),
    ]);
  }
}
