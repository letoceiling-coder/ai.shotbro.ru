import { config as loadEnv } from "dotenv";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { resolve } from "node:path";
import pino from "pino";
import { runMediaCleanup } from "./cleanup.js";
import { processAssetMetadata } from "./process-asset.js";
import { runStorageReconcile } from "./reconcile.js";
import { runProductionNode } from "./production-node.js";
import { eq } from "drizzle-orm";
import { agentRun } from "@shotbro/db/schema";
import { getWorkerDb } from "./db.js";
import { executeProductionRun } from "./production-run.js";
import { TALENT_EXECUTE_QUEUE, executeTalentJob } from "./talent-execution.js";
import { CANVAS_EXECUTE_QUEUE, executeCanvasRun } from "./canvas-execution.js";

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
  async (job) => {
    const data = job.data as { runId: string; projectId: string };
    try {
      return await executeProductionRun(job.data as never, log);
    } catch (err) {
      const db = getWorkerDb();
      const msg = err instanceof Error ? err.message : "production_run_failed";
      await db
        .update(agentRun)
        .set({ status: "FAILED", productionState: "FAILED", updatedAt: new Date() })
        .where(eq(agentRun.id, data.runId));
      log.error({ err, runId: data.runId, projectId: data.projectId }, msg);
      throw err;
    }
  },
  { ...workerOpts, concurrency: 1 },
);

// Phase 6B: avatar/voice provider jobs (mock adapters unless every live gate is open).
new Worker(
  TALENT_EXECUTE_QUEUE,
  async (job) => executeTalentJob(job.data as { jobId: string }, log),
  { ...workerOpts, concurrency: 1 },
);

// Phase 6E: approved scene-canvas runs (mock outputs unless live generation is wired in 6G).
new Worker(
  CANVAS_EXECUTE_QUEUE,
  async (job) => executeCanvasRun(job.data as { runId: string }, log),
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

log.info("SHOTBRO worker started (media, production, talent, canvas jobs; live media gated)");

async function shutdown() {
  log.info("worker shutting down");
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
