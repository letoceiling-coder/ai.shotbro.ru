import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "@shotbro/config/s3";
import { and, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Logger } from "pino";
import { agentRun, asset, productionGraphNode, productionDocument } from "@shotbro/db/schema";
import { getWorkerDb } from "./db.js";
import { ensureMockFixtures, readFixture } from "./mock-fixtures.js";

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

  const nodes = await db
    .select()
    .from(productionGraphNode)
    .where(and(eq(productionGraphNode.projectId, data.projectId), eq(productionGraphNode.agentRunId, data.runId)));

  const sceneVideoAssets: string[] = [];
  let voiceAssetId: string | undefined;

  for (const node of nodes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (node.status === "COMPLETED" || node.status === "CANCELLED") continue;
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
        const out = await assembleMp4(fixtures, sceneVideoAssets, log);
        const assetId = randomUUID();
        const key = `workspaces/${data.workspaceId}/projects/${data.projectId}/assets/${assetId}/mock/final.mp4`;
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
            assetId,
            voiceAssetId,
            sceneVideoAssets,
            aspectRatio: "9:16",
          },
          createdBy: data.ownerId,
        });
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

  await db
    .update(agentRun)
    .set({
      status: "COMPLETED",
      productionState: "COMPLETED",
      metadata: { mock: true, deliveryReady: true },
      updatedAt: new Date(),
    })
    .where(eq(agentRun.id, data.runId));

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
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}
