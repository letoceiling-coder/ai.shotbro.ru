import { config as loadEnv } from "dotenv";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { resolve } from "node:path";
import pino from "pino";
import { processAssetMetadata } from "./process-asset.js";

loadEnv({ path: resolve(process.cwd(), "../../.env.production") });

const log = pino({ name: "worker" });
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const workerOpts = {
  connection,
  concurrency: 2,
  settings: { backoffStrategy: (attempts: number) => Math.min(attempts * 2000, 30_000) },
};

new Worker(
  "media.metadata",
  async (job) => {
    const assetId = job.data.assetId as string;
    log.info({ jobId: job.id, assetId }, "media.metadata start");
    return processAssetMetadata(assetId, log);
  },
  workerOpts,
);

new Worker(
  "media.cleanup",
  async (job) => {
    log.info({ jobId: job.id, data: job.data }, "media.cleanup");
    return { ok: true };
  },
  { ...workerOpts, concurrency: 1 },
);

log.info("SHOTBRO worker started (media jobs only, no AI)");

async function shutdown() {
  log.info("worker shutting down");
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
