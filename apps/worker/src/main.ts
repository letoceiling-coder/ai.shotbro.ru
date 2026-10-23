import { config as loadEnv } from "dotenv";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { resolve } from "node:path";
import pino from "pino";
import { runMediaCleanup } from "./cleanup.js";
import { processAssetMetadata } from "./process-asset.js";
import { runStorageReconcile } from "./reconcile.js";
import { runProductionNode } from "./production-node.js";
import { executeProductionRun } from "./production-run.js";

loadEnv({ path: resolve(process.cwd(), "../../.env.production") });

const log = pino({ name: "worker" });
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const workerOpts = {
  connection,
  concurrency: 2,
  settings: { backoffStrategy: (attempts: number) => Math.min(attempts * 2000, 30_000) },
  limiter: { max: 10, duration: 1000 },
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
  "media.thumbnail",
  async (job) => {
    const assetId = job.data.assetId as string;
    return processAssetMetadata(assetId, log);
  },
  workerOpts,
);

new Worker(
  "media.poster",
  async (job) => {
    const assetId = job.data.assetId as string;
    return processAssetMetadata(assetId, log);
  },
  workerOpts,
);

new Worker(
  "media.cleanup",
  async (job) => {
    log.info({ jobId: job.id }, "media.cleanup start");
    return runMediaCleanup(log);
  },
  { ...workerOpts, concurrency: 1 },
);

new Worker(
  "production.node",
  async (job) => runProductionNode(job.data as never, log),
  { ...workerOpts, concurrency: 2 },
);

new Worker(
  "production.run",
  async (job) => executeProductionRun(job.data as never, log),
  { ...workerOpts, concurrency: 1 },
);

new Worker(
  "storage.reconcile",
  async (job) => {
    log.info({ jobId: job.id }, "storage.reconcile start");
    return runStorageReconcile(log);
  },
  { ...workerOpts, concurrency: 1 },
);

log.info("SHOTBRO worker started (media + storage maintenance, no AI)");

async function shutdown() {
  log.info("worker shutting down");
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
