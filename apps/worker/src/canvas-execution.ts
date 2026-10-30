import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Logger } from "pino";
import sharp from "sharp";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { createS3Client } from "@shotbro/config/s3";
import { approval, asset, budgetReservation, conversation, costLedgerEntry, eventLog, message, messageBlock, providerJob } from "@shotbro/db/schema";
import { assetPlaybackRef } from "@shotbro/contracts/asset-playback";
import { probeMediaBuffer } from "./ffprobe.js";
import { getWorkerDb } from "./db.js";
import { ensureMockFixtures, readFixture } from "./mock-fixtures.js";

export const CANVAS_EXECUTE_QUEUE = "canvas.execute";

const execFileAsync = promisify(execFile);

/** Mirrors CanvasRunStep in @shotbro/ai (worker NodeNext cannot resolve the barrel). */
type StepInput = { nodeId: string; kind: string; type: string; inPlan: boolean; assetId: string | null };
type Step = {
  nodeId: string;
  kind: "first_frame" | "scene_video" | "avatar_video" | "tts" | "upscale" | "assembly";
  sceneId: string | null;
  durationSeconds: number;
  text: string;
  inputs: StepInput[];
  resolved?: { videoOrder?: string[] } & Record<string, unknown>;
};
type JobMeta = {
  kind: "canvas";
  canvasRunId: string;
  canvasNodeId: string;
  approvalId: string;
  reservationId: string;
  workspaceId: string;
  ownerId: string;
  order: number;
  chargedUsd: number;
  step: Step;
  mock: boolean;
  outputMimeType?: string;
  conversationId?: string;
};
type JobRow = typeof providerJob.$inferSelect;

class CanvasJobError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]);

function s3() {
  return {
    client: createS3Client({
      S3_ENDPOINT: process.env.S3_ENDPOINT!,
      S3_REGION: process.env.S3_REGION!,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
      S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
    }),
    bucket: process.env.S3_BUCKET!,
  };
}

const metaOf = (j: JobRow) => (j.metadata ?? {}) as JobMeta;

async function emit(meta: JobMeta, projectId: string, status: string, jobId: string) {
  await getWorkerDb()
    .insert(eventLog)
    .values({
      id: randomUUID(),
      workspaceId: meta.workspaceId,
      projectId,
      resourceId: meta.canvasNodeId,
      type: "canvas.updated",
      payload: { canvasRunId: meta.canvasRunId, nodeId: meta.canvasNodeId, status, providerJobId: jobId },
    });
}

async function setJob(jobId: string, patch: Partial<typeof providerJob.$inferInsert>) {
  await getWorkerDb()
    .update(providerJob)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(providerJob.id, jobId));
}

async function isApproved(approvalId: string, projectId: string) {
  const [row] = await getWorkerDb()
    .select()
    .from(approval)
    .where(and(eq(approval.id, approvalId), eq(approval.projectId, projectId)))
    .limit(1);
  return row?.status === "APPROVED" && row.targetType === "CANVAS_RUN" && (!row.expiresAt || row.expiresAt > new Date());
}

async function readAsset(id: string, workspaceId: string) {
  const [row] = await getWorkerDb().select().from(asset).where(eq(asset.id, id)).limit(1);
  // Tenancy re-check: never use another workspace's media.
  if (!row || row.workspaceId !== workspaceId || row.status !== "READY" || row.deletedAt) {
    throw new CanvasJobError("ASSET_NOT_ACCESSIBLE", `asset ${id} not usable`);
  }
  const { client, bucket } = s3();
  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.storageKey }));
  if (!got.Body) throw new CanvasJobError("ASSET_MISSING", `asset ${id} has no body`);
  return { row, data: Buffer.from(await got.Body.transformToByteArray()) };
}

async function storeAsset(meta: JobMeta, projectId: string, body: Buffer, mimeType: string, name: string) {
  const { client, bucket } = s3();
  const id = randomUUID();
  const ext = mimeType === "audio/mpeg" ? "mp3" : (mimeType.split("/")[1] ?? "bin");
  const key = `workspaces/${meta.workspaceId}/projects/${projectId}/assets/${id}/canvas/${id}.${ext}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mimeType }));
  await getWorkerDb()
    .insert(asset)
    .values({
      id,
      workspaceId: meta.workspaceId,
      projectId,
      ownerId: meta.ownerId,
      mimeType,
      originalName: name,
      storageKey: key,
      sizeBytes: body.length,
      checksum: createHash("sha256").update(body).digest("hex"),
      status: "READY",
      category: meta.mock ? "mock_generation" : "generation",
    });
  return id;
}

/** Distinct colour per run so every version of a node is visibly different in mock mode. */
function runColour(seed: string) {
  const h = createHash("sha256").update(seed).digest();
  return { r: 40 + (h[0]! % 160), g: 40 + (h[1]! % 160), b: 40 + (h[2]! % 160) };
}

const hex = (c: { r: number; g: number; b: number }) =>
  `0x${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

async function mockImage(seed: string) {
  return sharp({ create: { width: 720, height: 1280, channels: 3, background: runColour(seed) } })
    .png()
    .toBuffer();
}

async function mockVideo(seed: string, seconds: number, tmpRoot: string, log: Logger) {
  const dir = join(tmpRoot, `canvas-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const out = join(dir, "clip.mp4");
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", `color=c=${hex(runColour(seed))}:s=720x1280:d=${seconds}:r=25`, "-pix_fmt", "yuv420p", "-c:v", "libx264", out],
      { timeout: 90_000 },
    );
    return await readFile(out);
  } catch (e) {
    log.warn({ err: e }, "canvas mock video: ffmpeg failed, using fixture");
    return readFixture("scene.mp4");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Real assembly with ffmpeg: input clips in scene order, normalised to 720×1280, optional voice track. */
async function assemble(videos: Buffer[], audio: Buffer | null, tmpRoot: string) {
  const dir = join(tmpRoot, `canvas-asm-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    const args = ["-y"];
    for (const [i, v] of videos.entries()) {
      const p = join(dir, `in${i}.mp4`);
      await writeFile(p, v);
      args.push("-i", p);
    }
    if (audio) {
      const ap = join(dir, "voice.mp3");
      await writeFile(ap, audio);
      args.push("-i", ap);
    }
    const norm = videos
      .map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`)
      .join(";");
    const concat = `${videos.map((_, i) => `[v${i}]`).join("")}concat=n=${videos.length}:v=1:a=0[vout]`;
    const out = join(dir, "out.mp4");
    args.push("-filter_complex", `${norm};${concat}`, "-map", "[vout]");
    if (audio) args.push("-map", `${videos.length}:a`, "-c:a", "aac");
    args.push("-c:v", "libx264", "-movflags", "+faststart", out);
    await execFileAsync("ffmpeg", args, { timeout: 180_000 });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Settles the run's reservation: completed nodes are captured, the rest released. */
async function settle(jobs: JobRow[], projectId: string, mock: boolean) {
  const db = getWorkerDb();
  const meta = metaOf(jobs[0]!);
  const [r] = await db.select().from(budgetReservation).where(eq(budgetReservation.id, meta.reservationId)).limit(1);
  if (!r || r.status !== "HELD") return;
  const fresh = await db.select().from(providerJob).where(inArray(providerJob.id, jobs.map((j) => j.id)));
  const captured = Math.round(fresh.filter((j) => j.status === "COMPLETED").reduce((s, j) => s + metaOf(j).chargedUsd, 0) * 100) / 100;
  const released = Math.round((r.amountUsd - captured) * 100) / 100;
  await db
    .update(budgetReservation)
    .set({ status: captured > 0 || fresh.some((j) => j.status === "COMPLETED") ? "CAPTURED" : "RELEASED", updatedAt: new Date() })
    .where(and(eq(budgetReservation.id, r.id), eq(budgetReservation.status, "HELD")));
  const source = mock ? "mock" : "canvas";
  if (captured > 0 || fresh.some((j) => j.status === "COMPLETED")) {
    await db.insert(costLedgerEntry).values({
      id: randomUUID(),
      projectId,
      reservationId: r.id,
      entryType: "CAPTURE",
      amountUsd: captured,
      source,
      mock: mock ? 1 : 0,
      metadata: { approvalId: meta.approvalId, canvasRunId: meta.canvasRunId },
    });
  }
  if (released > 0) {
    await db.insert(costLedgerEntry).values({
      id: randomUUID(),
      projectId,
      reservationId: r.id,
      entryType: "RELEASE",
      amountUsd: released,
      source,
      mock: mock ? 1 : 0,
      metadata: { approvalId: meta.approvalId, canvasRunId: meta.canvasRunId, reason: "nodes_failed" },
    });
  }
}

async function failJob(job: JobRow, code: string, message: string, log: Logger) {
  await setJob(job.id, { status: "FAILED", failedAt: new Date(), failureCode: code, actualUsage: { error: message.slice(0, 500) } });
  await emit(metaOf(job), job.projectId, "FAILED", job.id);
  log.warn({ jobId: job.id, code, message }, "canvas node failed");
}

/** Phase 6F: the finished cut goes to the chat where the user approved the price. */
async function postDeliveryToChat(job: JobRow, assetId: string, body: Buffer, log: Logger) {
  const meta = metaOf(job);
  if (!meta.conversationId) return;
  const db = getWorkerDb();
  const [conv] = await db.select().from(conversation).where(eq(conversation.id, meta.conversationId)).limit(1);
  if (!conv || conv.projectId !== job.projectId) return;
  let seconds: number | null = null;
  try {
    const probe = await probeMediaBuffer(body, "mp4");
    seconds = probe.durationMs ? Math.round(probe.durationMs / 1000) : null;
  } catch {
    /* duration label is optional */
  }
  const messageId = randomUUID();
  await db.insert(message).values({
    id: messageId,
    conversationId: conv.id,
    projectId: job.projectId,
    role: "assistant",
    content: meta.mock ? "Ролик собран на холсте (тестовый режим)" : "Ролик собран на холсте",
    status: "sent",
  });
  await db.insert(messageBlock).values({
    id: randomUUID(),
    messageId,
    type: "video_result",
    payload: {
      type: "video_result",
      // Live canvas generation is blocked until 6G, so this card is always a test-mode result.
      demo: true,
      title: meta.mock ? "Ролик с холста (MOCK)" : "Ролик с холста",
      assetId,
      url: assetPlaybackRef(assetId),
      durationLabel: seconds ? `${seconds}s` : "—",
      aspectRatio: "9:16",
      resolution: "720×1280",
      version: 1,
      source: "canvas",
      canvasRunId: meta.canvasRunId,
    },
  });
  await db.insert(eventLog).values({
    id: randomUUID(),
    workspaceId: meta.workspaceId,
    projectId: job.projectId,
    resourceId: messageId,
    type: "message.created",
    payload: { messageId, conversationId: conv.id, projectId: job.projectId, blockTypes: ["video_result"] },
  });
  log.info({ messageId, assetId, canvasRunId: meta.canvasRunId }, "canvas delivery posted to chat");
}

/** Executes every node of one approved canvas run in plan order. */
export async function executeCanvasRun(data: { runId: string }, log: Logger) {
  const db = getWorkerDb();
  const env = loadEnvFromProcess();
  const jobs = (
    await db
      .select()
      .from(providerJob)
      .where(sql`${providerJob.metadata}->>'canvasRunId' = ${data.runId}`)
  ).sort((a, b) => metaOf(a).order - metaOf(b).order);
  if (!jobs.length) return { skipped: "missing" };
  const projectId = jobs[0]!.projectId;
  const first = metaOf(jobs[0]!);
  const fixtures = await ensureMockFixtures(log);
  const outputs = new Map<string, { assetId: string; mimeType: string }>();
  const failed = new Set<string>();

  for (const job of jobs) {
    const meta = metaOf(job);
    if (TERMINAL.has(job.status)) {
      if (job.status === "COMPLETED" && job.outputAssetIds?.[0]) {
        outputs.set(meta.canvasNodeId, { assetId: job.outputAssetIds[0], mimeType: meta.outputMimeType ?? "" });
      } else failed.add(meta.canvasNodeId);
      continue;
    }
    // Defense in depth: the API only creates jobs for approved quotes; re-check before every node.
    if (!(await isApproved(meta.approvalId, projectId))) {
      await failJob(job, "APPROVAL_REQUIRED", "no approved cost confirmation", log);
      failed.add(meta.canvasNodeId);
      continue;
    }
    // Never fake success: live canvas generation is not wired yet, so outside mock mode it fails.
    if (!env.AI_MOCK_MODE || !meta.mock) {
      await failJob(job, "LIVE_BLOCKED", "live canvas generation is not enabled (Phase 6G)", log);
      failed.add(meta.canvasNodeId);
      continue;
    }

    await setJob(job.id, { status: "RUNNING", startedAt: new Date(), attemptCount: job.attemptCount + 1 });
    await emit(meta, projectId, "RUNNING", job.id);
    try {
      const step = meta.step;
      const inputAsset = (i: StepInput) => {
        if (!i.inPlan) return i.assetId;
        if (failed.has(i.nodeId)) throw new CanvasJobError("UPSTREAM_FAILED", `input ${i.nodeId} failed`);
        return outputs.get(i.nodeId)?.assetId ?? null;
      };
      const seed = `${job.id}:${step.nodeId}`;
      let body: Buffer;
      let mimeType: string;
      if (step.kind === "first_frame" || step.kind === "upscale") {
        for (const i of step.inputs.filter((x) => x.type === "image")) {
          const id = inputAsset(i);
          if (id) await readAsset(id, meta.workspaceId); // validates access to the reference
        }
        body = await mockImage(seed);
        mimeType = "image/png";
      } else if (step.kind === "scene_video" || step.kind === "avatar_video") {
        for (const i of step.inputs.filter((x) => x.type === "image" || x.type === "audio")) {
          const id = inputAsset(i);
          if (!id && step.kind === "scene_video" && i.type === "image") throw new CanvasJobError("INPUT_MISSING", "first frame missing");
          if (id) await readAsset(id, meta.workspaceId);
        }
        body = await mockVideo(seed, Math.min(10, Math.max(1, Math.round(step.durationSeconds))), fixtures.root, log);
        mimeType = "video/mp4";
      } else if (step.kind === "tts") {
        body = await readFixture("voice.mp3");
        mimeType = "audio/mpeg";
      } else {
        const order = step.resolved?.videoOrder ?? step.inputs.filter((i) => i.type === "video").map((i) => i.nodeId);
        const byNode = new Map(step.inputs.map((i) => [i.nodeId, i]));
        const videos: Buffer[] = [];
        for (const nodeId of order) {
          const i = byNode.get(nodeId);
          if (!i || i.type !== "video") continue;
          const id = inputAsset(i);
          if (!id) throw new CanvasJobError("INPUT_MISSING", `video ${nodeId} missing`);
          videos.push((await readAsset(id, meta.workspaceId)).data);
        }
        if (!videos.length) throw new CanvasJobError("INPUT_MISSING", "no videos to assemble");
        const audioInput = step.inputs.find((i) => i.type === "audio");
        const audioId = audioInput ? inputAsset(audioInput) : null;
        const audio = audioId ? (await readAsset(audioId, meta.workspaceId)).data : null;
        body = await assemble(videos, audio, fixtures.root);
        mimeType = "video/mp4";
      }
      const ext = mimeType === "audio/mpeg" ? "mp3" : mimeType.split("/")[1];
      const assetId = await storeAsset(meta, projectId, body, mimeType, `canvas-${step.kind}-${job.id.slice(0, 8)}.${ext}`);
      outputs.set(meta.canvasNodeId, { assetId, mimeType });
      await db.insert(costLedgerEntry).values({
        id: randomUUID(),
        projectId,
        entryType: "ACTUAL",
        amountUsd: meta.chargedUsd,
        source: `mock:${job.providerId}`,
        mock: 1,
        metadata: { providerJobId: job.id, canvasNodeId: meta.canvasNodeId, kind: step.kind },
      });
      await setJob(job.id, {
        status: "COMPLETED",
        completedAt: new Date(),
        outputAssetIds: [assetId],
        actualUsage: { bytes: body.length },
        metadata: { ...meta, outputMimeType: mimeType } as unknown as Record<string, unknown>,
      });
      await emit(meta, projectId, "COMPLETED", job.id);
      if (step.kind === "assembly") {
        // A chat hiccup must not fail an already finished, captured node.
        await postDeliveryToChat(job, assetId, body, log).catch((e) => log.warn({ err: e }, "canvas delivery chat post failed"));
      }
    } catch (err) {
      const code = err instanceof CanvasJobError ? err.code : "CANVAS_NODE_FAILED";
      await failJob(job, code, err instanceof Error ? err.message : "failed", log);
      failed.add(meta.canvasNodeId);
    }
  }

  await settle(jobs, projectId, env.AI_MOCK_MODE);
  log.info({ runId: data.runId, nodes: jobs.length, failed: failed.size, approvalId: first.approvalId }, "canvas run finished");
  return { runId: data.runId, failed: failed.size };
}
