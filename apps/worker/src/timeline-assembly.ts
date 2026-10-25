import { GetObjectCommand } from "@aws-sdk/client-s3";
import { and, desc, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { S3Client } from "@aws-sdk/client-s3";
import type { Logger } from "pino";
import { parseStoryboardDocument } from "@shotbro/contracts";
import {
  TimelineDocumentSchema,
  type TimelineDocument,
  type TimelineClip,
  type TimelineTrack,
} from "../../../packages/contracts/src/production/timeline-schemas.ts";

function parseTimelinePayload(raw: unknown, rowSchemaVersion?: number): TimelineDocument | null {
  try {
    const base =
      raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : (raw as Record<string, unknown>);
    if (base && base.schemaVersion !== 2 && rowSchemaVersion === 2) {
      base.schemaVersion = 2;
    }
    if (base?.schemaVersion !== 2) return null;
    return TimelineDocumentSchema.parse(base);
  } catch {
    return null;
  }
}

export async function projectHasTimelineV2(db: Db, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: productionDocument.id })
    .from(productionDocument)
    .where(
      and(
        eq(productionDocument.projectId, projectId),
        eq(productionDocument.docType, "TIMELINE"),
        eq(productionDocument.schemaVersion, 2),
      ),
    )
    .limit(1);
  return Boolean(row);
}
import type { Db } from "@shotbro/db/client";
import { asset, productionDocument, productionGraphNode } from "@shotbro/db/schema";
import { readFixture } from "./mock-fixtures.js";

const execFileAsync = promisify(execFile);

/** Mock assembly: scene script order → red, green, blue (proof-friendly). Fallback palette otherwise. */
const SCENE_MOCK_COLORS = ["0xff0000", "0x00ff00", "0x0000ff", "0xff8800", "0x8800ff"];
const COLORS = ["0x112233", "0x223311", "0x331122", "0x113322", "0x221133"];

function sceneIdFromClip(clip: TimelineClip): string | undefined {
  if (clip.sceneId) return clip.sceneId;
  const prefix = "scene-";
  if (clip.clipId.startsWith(prefix)) return clip.clipId.slice(prefix.length);
  return undefined;
}

async function latestProductionDoc(db: Db, projectId: string, docType: "STORYBOARD" | "SCRIPT") {
  const [row] = await db
    .select()
    .from(productionDocument)
    .where(and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, docType)))
    .orderBy(desc(productionDocument.version))
    .limit(1);
  return row;
}

/** Timeline clips use storyboard `sceneId` (matches script `id` when synced). */
async function mockSceneIdOrder(db: Db, projectId: string): Promise<string[]> {
  const boardRow = await latestProductionDoc(db, projectId, "STORYBOARD");
  if (boardRow?.payload) {
    try {
      const parsed = parseStoryboardDocument(boardRow.payload);
      if (parsed.scenes?.length) {
        return [...parsed.scenes]
          .sort((a, b) => a.order - b.order)
          .map((s) => s.sceneId)
          .filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  const scriptRow = await latestProductionDoc(db, projectId, "SCRIPT");
  const scriptScenes =
    (scriptRow?.payload as { scenes?: { id?: string; sceneId?: string; sequence?: number }[] } | undefined)?.scenes ?? [];
  return [...scriptScenes]
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((s) => s.id ?? s.sceneId)
    .filter((id): id is string => Boolean(id));
}

function mockColorForScene(sceneOrder: string[], clip: TimelineClip, clipIndex: number) {
  const sceneId = sceneIdFromClip(clip);
  if (sceneId) {
    const idx = sceneOrder.indexOf(sceneId);
    if (idx >= 0) return SCENE_MOCK_COLORS[idx % SCENE_MOCK_COLORS.length]!;
  }
  return COLORS[clipIndex % COLORS.length]!;
}

export async function loadTimelineForAssembly(
  db: Db,
  projectId: string,
  runMeta: { timelineVersion?: number; timelineDocumentId?: string },
): Promise<TimelineDocument | null> {
  if (runMeta.timelineVersion) {
    const [row] = await db
      .select()
      .from(productionDocument)
      .where(
        and(
          eq(productionDocument.projectId, projectId),
          eq(productionDocument.docType, "TIMELINE"),
          eq(productionDocument.version, runMeta.timelineVersion),
          eq(productionDocument.schemaVersion, 2),
        ),
      )
      .limit(1);
    const parsed = row ? parseTimelinePayload(row.payload, row.schemaVersion) : null;
    if (parsed) return parsed;
  }
  if (runMeta.timelineDocumentId) {
    const [row] = await db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.id, runMeta.timelineDocumentId), eq(productionDocument.schemaVersion, 2)),
      )
      .limit(1);
    const parsed = row ? parseTimelinePayload(row.payload, row.schemaVersion) : null;
    if (parsed) return parsed;
  }
  const [latestV2] = await db
    .select()
    .from(productionDocument)
    .where(
      and(
        eq(productionDocument.projectId, projectId),
        eq(productionDocument.docType, "TIMELINE"),
        eq(productionDocument.schemaVersion, 2),
      ),
    )
    .orderBy(desc(productionDocument.version))
    .limit(1);
  if (!latestV2) return null;
  return parseTimelinePayload(latestV2.payload, latestV2.schemaVersion);
}

async function sceneVideoMap(db: Db, projectId: string, runId: string) {
  const nodes = await db
    .select()
    .from(productionGraphNode)
    .where(and(eq(productionGraphNode.projectId, projectId), eq(productionGraphNode.agentRunId, runId)));
  const map = new Map<string, string>();
  for (const n of nodes) {
    if (n.nodeType !== "VIDEO_GENERATION") continue;
    const sceneId = (n.inputRefs as { sceneId?: string })?.sceneId;
    const out = n.outputAssetIds?.[0];
    if (sceneId && out) map.set(sceneId, out);
  }
  return map;
}

async function downloadAssetToFile(
  s3: S3Client,
  bucket: string,
  db: Db,
  assetId: string,
  dest: string,
  log: Logger,
) {
  const [row] = await db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
  if (!row?.storageKey) throw new Error(`asset_missing:${assetId}`);
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: row.storageKey }));
  const chunks: Buffer[] = [];
  const body = obj.Body as AsyncIterable<Uint8Array> | undefined;
  if (body && Symbol.asyncIterator in body) {
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
  }
  const buf = Buffer.concat(chunks);
  if (!buf.length) {
    log.warn({ assetId }, "empty asset — using fixture");
    await writeFile(dest, await readFixture("scene.mp4"));
    return;
  }
  await writeFile(dest, buf);
}

async function renderColorSegment(path: string, color: string, durationSec: number) {
  await execFileAsync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", `color=c=${color}:s=720x1280:d=${durationSec}`, "-pix_fmt", "yuv420p", path],
    { timeout: 120_000 },
  );
}

export async function assembleFromTimeline(input: {
  db: Db;
  s3: S3Client;
  bucket: string;
  projectId: string;
  runId: string;
  timeline: TimelineDocument;
  tmpRoot: string;
  log: Logger;
}) {
  const { db, s3, bucket, projectId, runId, timeline, tmpRoot, log } = input;
  const sceneMap = await sceneVideoMap(db, projectId, runId);
  const mockColorSegments = process.env.AI_MOCK_MODE === "true";
  const sceneOrder = mockColorSegments ? await mockSceneIdOrder(db, projectId) : [];
  const videoTrack = timeline.tracks.find((t: TimelineTrack) => t.type === "VIDEO");
  const clips = [...(videoTrack?.clips ?? [])].sort((a, b) => a.order - b.order);
  if (!clips.length) throw new Error("timeline_no_video_clips");

  const tmp = join(tmpRoot, "tl-" + randomUUID());
  await mkdir(tmp, { recursive: true });
  const segmentPaths: string[] = [];

  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]!;
      const seg = join(tmp, `seg-${i}.mp4`);
      const durSec = Math.max(0.5, clip.durationMs / 1000);
      const assetId = clip.assetId ?? (clip.sceneId ? sceneMap.get(clip.sceneId) : undefined);
      if (mockColorSegments) {
        await renderColorSegment(seg, mockColorForScene(sceneOrder, clip, i), durSec);
      } else if (assetId) {
        const raw = join(tmp, `raw-${i}.mp4`);
        await downloadAssetToFile(s3, bucket, db, assetId, raw, log);
        const trimStart = (clip.sourceInMs / 1000).toFixed(3);
        await execFileAsync(
          "ffmpeg",
          ["-y", "-ss", trimStart, "-i", raw, "-t", String(durSec), "-an", "-pix_fmt", "yuv420p", seg],
          { timeout: 120_000 },
        );
      } else {
        await renderColorSegment(seg, COLORS[i % COLORS.length]!, durSec);
      }
      segmentPaths.push(seg);
    }

    const voiceTrack = timeline.tracks.find((t: TimelineTrack) => t.type === "VOICEOVER");
    const voiceClip = voiceTrack?.clips?.[0];
    let voicePath: string | undefined;
    if (voiceClip?.assetId) {
      voicePath = join(tmp, "voice.mp3");
      await downloadAssetToFile(s3, bucket, db, voiceClip.assetId, voicePath, log);
    }

    const listPath = join(tmp, "list.txt");
    await writeFile(listPath, segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n") + "\n");
    const concatOut = join(tmp, "concat.mp4");
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatOut],
      { timeout: 120_000 },
    );

    const outPath = join(tmp, "out.mp4");
    if (voicePath) {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          concatOut,
          "-i",
          voicePath,
          "-filter_complex",
          "[1:a]volume=1[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]",
          "-map",
          "0:v",
          "-map",
          "[aout]",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          outPath,
        ],
        { timeout: 180_000 },
      ).catch(async () => {
        await execFileAsync(
          "ffmpeg",
          ["-y", "-i", concatOut, "-i", voicePath, "-c:v", "copy", "-c:a", "aac", "-shortest", outPath],
          { timeout: 180_000 },
        );
      });
    } else {
      await execFileAsync("ffmpeg", ["-y", "-i", concatOut, "-c", "copy", outPath], { timeout: 120_000 });
    }

    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(outPath);
    const hash = createHash("sha256").update(buffer).digest("hex");
    return { buffer, path: outPath, timelineHash: computeTimelineHash(timeline), clipCount: clips.length, outputHash: hash };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

function computeTimelineHash(doc: TimelineDocument) {
  return createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}

export function orderedClipsForDebug(timeline: TimelineDocument): TimelineClip[] {
  const video = timeline.tracks.find((t: TimelineTrack) => t.type === "VIDEO");
  return [...(video?.clips ?? [])].sort((a, b) => a.order - b.order);
}
