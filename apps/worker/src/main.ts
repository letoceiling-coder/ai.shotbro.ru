import { config as loadEnv } from "dotenv";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { resolve } from "node:path";
import pino from "pino";

loadEnv({ path: resolve(process.cwd(), "../../.env.production") });

const log = pino({ name: "worker" });
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

/** Phase 2: non-generative jobs only */
new Worker(
  "media-metadata",
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, "processing media metadata stub");
    return { ok: true };
  },
  { connection, concurrency: 2 },
);

new Worker(
  "cleanup",
  async (job) => {
    log.info({ jobId: job.id }, "cleanup stub");
    return { ok: true };
  },
  { connection, concurrency: 1 },
);

log.info("SHOTBRO worker started (no AI jobs)");
