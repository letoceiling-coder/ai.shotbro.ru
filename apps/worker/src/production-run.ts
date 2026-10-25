import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "@shotbro/config/s3";
import { and, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Logger } from "pino";
import { agentRun, asset, message, messageBlock, productionGraphNode, productionDocument } from "@shotbro/db/schema";
import { getWorkerDb } from "./db.js";
import { ensureMockFixtures, readFixture } from "./mock-fixtures.js";
import { orderGraphNodes } from "./graph-order.js";
import { assembleFromTimeline, loadTimelineForAssembly } from "./timeline-assembly.js";

const execFileAsync = promisify(execFile);

export async function executeProductionRun(
  data: { runId: string; projectId: string; ownerId: string; workspaceId: string },
  log: Logger,
) {
  const db = getWorkerDb();
  const fixtures = await ensureMockFixtures(log);
  const s3 = createS3Client({
    S3_ENDPOINT: process.env.S3_ENDPOINT!,
    S3_REGION: process.env.S3_REGION!,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
  });
  const bucket = process.env.S3_BUCKET!;

  const [runRow] = await db.select().from(agentRun).where(eq(agentRun.id, data.runId)).limit(1);
  if (runRow?.status === "COMPLETED" && runRow.productionState === "COMPLETED") {
    log.info({ runId: data.runId }, "production.run already completed");
    return { runId: data.runId, status: "COMPLETED" };
  }

  const nodes = await db
    .select()
    .from(productionGraphNode)
    .where(and(eq(productionGraphNode.projectId, data.projectId), eq(productionGraphNode.agentRunId, data.runId)));

  const sceneVideoAssets: string[] = [];
  let voiceAssetId: string | undefined;
  const priorRunMeta = (runRow?.metadata ?? {}) as { deliveryAssetId?: string; deliveryMessageId?: string };
  let deliveryAssetId: string | undefined = priorRunMeta.deliveryAssetId;

  for (const node of orderGraphNodes(nodes)) {
    if (node.status === "COMPLETED" || node.status === "CANCELLED") {
      if (node.nodeType === "VIDEO_GENERATION" && node.outputAssetIds?.[0]) {
        sceneVideoAssets.push(node.outputAssetIds[0]);
      }
      if (node.nodeType === "VOICEOVER" && node.outputAssetIds?.[0]) voiceAssetId = node.outputAssetIds[0];
      continue;
    }
    const existingOut = node.outputAssetIds?.[0];
    if (existingOut) {
      if (node.nodeType === "VIDEO_GENERATION") sceneVideoAssets.push(existingOut);
      if (node.nodeType === "VOICEOVER") voiceAssetId = existingOut;
      continue;
    }
    await db.update(productionGraphNode).set({ status: "RUNNING", updatedAt: new Date() }).where(eq(productionGraphNode.id, node.id));

    try {
      if (node.nodeType === "IMAGE_GENERATION" || node.nodeType === "VIDEO_GENERATION" || node.nodeType === "VOICEOVER") {
        const kind = node.nodeType === "IMAGE_GENERATION" ? "image/png" : node.nodeType === "VIDEO_GENERATION" ? "video/mp4" : "audio/mpeg";
        const ext = kind.split("/")[1] === "mpeg" ? "mp3" : kind.split("/")[1];
        const body =
          node.nodeType === "IMAGE_GENERATION"
            ? await readFixture("scene.png")
            : node.nodeType === "VIDEO_GENERATION"
              ? await readFixture("scene.mp4")
              : await readFixture("voice.mp3");
        const assetId = randomUUID();
        const key = `workspaces/${data.workspaceId}/projects/${data.projectId}/assets/${assetId}/mock/${node.id}.${ext}`;
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: kind }));
        const checksum = createHash("sha256").update(body).digest("hex");
        await db.insert(asset).values({
          id: assetId,
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          ownerId: data.ownerId,
          mimeType: kind,
          originalName: `mock-${node.nodeType}-${node.id}.${ext}`,
          storageKey: key,
          sizeBytes: body.length,
          checksum,
          status: "READY",
          category: "mock_generation",
        });
        if (node.nodeType === "VIDEO_GENERATION") sceneVideoAssets.push(assetId);
        if (node.nodeType === "VOICEOVER") voiceAssetId = assetId;
        await db
          .update(productionGraphNode)
          .set({
            status: "COMPLETED",
            outputAssetIds: [assetId],
            providerId: "mock",
            updatedAt: new Date(),
          })
          .where(eq(productionGraphNode.id, node.id));
      } else if (node.nodeType === "ASSEMBLY") {
        if (deliveryAssetId && node.outputAssetIds?.includes(deliveryAssetId)) {
          await db
            .update(productionGraphNode)
            .set({ status: "COMPLETED", updatedAt: new Date() })
            .where(eq(productionGraphNode.id, node.id));
          continue;
        }
        const runMeta = (runRow?.metadata ?? {}) as {
          timelineVersion?: number;
          timelineDocumentId?: string;
          timelineHash?: string;
        };
        const timeline = await loadTimelineForAssembly(db, data.projectId, runMeta);
        let out: { buffer: Buffer; path: string; timelineHash?: string; clipCount?: number };
        let assemblyMeta: Record<string, unknown> = { legacy: true };
        if (timeline) {
          out = await assembleFromTimeline({
            db,
            s3,
            bucket,
            projectId: data.projectId,
            runId: data.runId,
            timeline,
            tmpRoot: fixtures.root,
            log,
          });
          assemblyMeta = {
            timelineVersion: runMeta.timelineVersion,
            timelineHash: runMeta.timelineHash ?? out.timelineHash,
            clipCount: out.clipCount,
          };
        } else {
          out = await assembleMp4(fixtures, sceneVideoAssets, log);
        }
        const assetId = randomUUID();
        const key = `workspaces/${data.workspaceId}/projects/${data.projectId}/assets/${assetId}/mock/final-${assetId.slice(0, 8)}.mp4`;
        const body = out.buffer;
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "video/mp4" }));
        await db.insert(asset).values({
          id: assetId,
          workspaceId: data.workspaceId,
          projectId: data.projectId,
          ownerId: data.ownerId,
          mimeType: "video/mp4",
          originalName: "mock-delivery.mp4",
          storageKey: key,
          sizeBytes: body.length,
          status: "READY",
          category: "mock_delivery",
        });
        await db.insert(productionDocument).values({
          id: randomUUID(),
          projectId: data.projectId,
          docType: "DELIVERY",
          version: 1,
          status: "ACTIVE",
          schemaVersion: 1,
          payload: {
            mock: true,
            runId: data.runId,
            assetId,
            voiceAssetId,
            sceneVideoAssets,
            aspectRatio: "9:16",
            ...assemblyMeta,
          },
          createdBy: data.ownerId,
        });
        deliveryAssetId = assetId;
        await db
          .update(productionGraphNode)
          .set({ status: "COMPLETED", outputAssetIds: [assetId], updatedAt: new Date() })
          .where(eq(productionGraphNode.id, node.id));
      } else {
        await db
          .update(productionGraphNode)
          .set({ status: "COMPLETED", updatedAt: new Date() })
          .where(eq(productionGraphNode.id, node.id));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "node failed";
      await db
        .update(productionGraphNode)
        .set({ status: "FAILED", errorMessage: msg, updatedAt: new Date() })
        .where(eq(productionGraphNode.id, node.id));
      throw e;
    }
  }

  const finalAssetId = deliveryAssetId;
  const [runAfter] = await db.select().from(agentRun).where(eq(agentRun.id, data.runId)).limit(1);
  const priorMeta = (runAfter?.metadata ?? {}) as {
    deliveryMessageId?: string;
    mock?: boolean;
    deliveryReady?: boolean;
    deliveryAssetId?: string;
  };

  await db
    .update(agentRun)
    .set({
      status: "COMPLETED",
      productionState: "COMPLETED",
      metadata: {
        ...priorMeta,
        mock: true,
        deliveryReady: true,
        deliveryAssetId: finalAssetId ?? priorMeta.deliveryAssetId,
      },
      updatedAt: new Date(),
    })
    .where(eq(agentRun.id, data.runId));

  if (runAfter?.conversationId && finalAssetId && !priorMeta.deliveryMessageId) {
    const messageId = randomUUID();
    await db.insert(message).values({
      id: messageId,
      conversationId: runAfter.conversationId,
      projectId: data.projectId,
      role: "assistant",
      content: "Готово: mock-ролик",
      status: "sent",
    });
    await db.insert(messageBlock).values({
      id: randomUUID(),
      messageId,
      type: "video_result",
      payload: {
        type: "video_result",
        demo: true,
        title: "Финальный ролик (MOCK)",
        assetId: finalAssetId,
        url: "",
        durationLabel: "15s",
        aspectRatio: "9:16",
        resolution: "720×1280",
        version: 1,
      },
    });
    await db
      .update(agentRun)
      .set({
        metadata: { ...priorMeta, mock: true, deliveryReady: true, deliveryAssetId: finalAssetId, deliveryMessageId: messageId },
        updatedAt: new Date(),
      })
      .where(eq(agentRun.id, data.runId));
  }

  log.info({ runId: data.runId, sceneVideos: sceneVideoAssets.length }, "production.run completed");
  return { runId: data.runId, status: "COMPLETED" };
}

async function assembleMp4(
  fixtures: Awaited<ReturnType<typeof ensureMockFixtures>>,
  _sceneIds: string[],
  log: Logger,
) {
  const tmp = join(fixtures.root, "assembly-" + randomUUID());
  await mkdir(tmp, { recursive: true });
  const listPath = join(tmp, "list.txt");
  const outPath = join(tmp, "out.mp4");
  const segment = join(tmp, "seg.mp4");
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "color=c=0x111122:s=720x1280:d=3", "-pix_fmt", "yuv420p", segment],
      { timeout: 60_000 },
    );
    await writeFile(listPath, `file '${segment.replace(/\\/g, "/")}'\n`);
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { timeout: 60_000 },
    );
    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(outPath);
    return { buffer, path: outPath };
  } catch (e) {
    log.warn({ err: e }, "ffmpeg assembly fallback to fixture clip");
    const buffer = await readFixture("scene.mp4");
    return { buffer, path: fixtures.videoPath };
  } finally {
    await rm(tmp, { recursive: true, fo