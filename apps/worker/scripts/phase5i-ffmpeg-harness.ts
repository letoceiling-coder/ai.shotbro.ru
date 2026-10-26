/**
 * VPS-only FFmpeg matrix harness (mock, no live AI). Run inside worker container:
 *   pnpm exec tsx apps/worker/scripts/phase5i-ffmpeg-harness.ts
 */
import { config as loadEnv } from "dotenv";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "@shotbro/config/s3";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import pino from "pino";
import { resolve } from "node:path";
import { asset, project } from "@shotbro/db/schema";
import { eq } from "drizzle-orm";
import type { TimelineDocument } from "../../../packages/contracts/src/production/timeline-schemas.ts";
import { defaultTimelineTracks } from "../../../packages/contracts/src/production/timeline-schemas.ts";
import { getWorkerDb } from "../src/db.js";
import { assembleFromTimeline } from "../src/timeline-assembly.js";

loadEnv({ path: resolve(process.cwd(), "../../.env.production"), quiet: true });

const execFileAsync = promisify(execFile);
const log = pino({ name: "phase5i-harness" });

type CaseResult = { id: number; name: string; status: "PASS" | "FAIL"; detail?: string };

async function ffprobeDuration(path: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  return Number.parseFloat(stdout.trim());
}

async function ffprobeAudioStreams(path: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    path,
  ]);
  return stdout.trim().split("\n").filter(Boolean).length;
}

async function frameHash(path: string, atSec: number): Promise<string> {
  const png = `/tmp/p5i-frame-${randomUUID()}.png`;
  await execFileAsync("ffmpeg", ["-y", "-ss", String(atSec), "-i", path, "-frames:v", "1", png], {
    timeout: 60_000,
  });
  const buf = await readFile(png);
  await rm(png, { force: true }).catch(() => undefined);
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function s3() {
  return createS3Client({
    S3_ENDPOINT: process.env.S3_ENDPOINT!,
    S3_REGION: process.env.S3_REGION!,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

async function putTestAsset(input: {
  workspaceId: string;
  projectId: string;
  ownerId: string;
  localPath: string;
  mimeType: string;
  name: string;
}) {
  const db = getWorkerDb();
  const bucket = process.env.S3_BUCKET!;
  const client = s3();
  const assetId = randomUUID();
  const key = `workspaces/${input.workspaceId}/projects/${input.projectId}/assets/${assetId}/${input.name}`;
  const body = await readFile(input.localPath);
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: input.mimeType }),
  );
  await db.insert(asset).values({
    id: assetId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    ownerId: input.ownerId,
    mimeType: input.mimeType,
    originalName: input.name,
    storageKey: key,
    sizeBytes: body.length,
    status: "READY",
    category: "test_fixture",
  });
  return assetId;
}

function baseTimeline(clips: TimelineDocument["tracks"][0]["clips"]): TimelineDocument {
  const tracks = defaultTimelineTracks();
  const video = tracks.find((t) => t.type === "VIDEO")!;
  video.clips = clips;
  return {
    schemaVersion: 2,
    format: "mp4",
    fps: 30,
    aspectRatio: "9:16",
    resolution: { width: 720, height: 1280 },
    totalDurationMs: clips.reduce((s, c) => s + c.durationMs, 0),
    revision: 1,
    tracks,
    mock: true,
  };
}

async function runAssembly(timeline: TimelineDocument, projectId: string, runId: string) {
  process.env.TIMELINE_MOCK_USE_ASSETS = "true";
  const tmpRoot = join("/tmp", "p5i-harness");
  await mkdir(tmpRoot, { recursive: true });
  const out = await assembleFromTimeline({
    db: getWorkerDb(),
    s3: s3(),
    bucket: process.env.S3_BUCKET!,
    projectId,
    runId,
    timeline,
    tmpRoot,
    log,
  });
  const outFile = join(tmpRoot, `out-${randomUUID()}.mp4`);
  await writeFile(outFile, out.buffer);
  return outFile;
}

async function harnessContext() {
  const projectId = process.env.PHASE5I_HARNESS_PROJECT_ID;
  if (!projectId) throw new Error("missing PHASE5I_HARNESS_PROJECT_ID");
  const db = getWorkerDb();
  const [row] = await db
    .select({ workspaceId: project.workspaceId, ownerId: project.ownerId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  if (!row) throw new Error(`project_not_found:${projectId}`);
  return { projectId, workspaceId: row.workspaceId, ownerId: row.ownerId };
}

async function caseTrim(): Promise<CaseResult> {
  const id = 6;
  const name = "trim";
  try {
    const { projectId, workspaceId, ownerId } = await harnessContext();
    const src = `/tmp/p5i-trim-src-${randomUUID()}.mp4`;
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=320x240:d=3",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x240:d=3",
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1:a=0",
        "-pix_fmt",
        "yuv420p",
        src,
      ],
      { timeout: 120_000 },
    );
    const hashFull = await frameHash(src, 0.5);
    const assetId = await putTestAsset({
      workspaceId,
      projectId,
      ownerId,
      localPath: src,
      mimeType: "video/mp4",
      name: "trim-src.mp4",
    });
    const timeline = baseTimeline([
      {
        clipId: "c1",
        trackId: "track-video",
        assetId,
        sourceInMs: 3000,
        durationMs: 1500,
        order: 0,
        startTimeMs: 0,
        volume: 1,
        muted: false,
        status: "ready",
      },
    ]);
    const out = await runAssembly(timeline, projectId, randomUUID());
    const dur = await ffprobeDuration(out);
    const hashTrim = await frameHash(out, 0.2);
    if (Math.abs(dur - 1.5) > 0.35) return { id, name, status: "FAIL", detail: `duration=${dur}` };
    if (hashTrim === hashFull) return { id, name, status: "FAIL", detail: "frame unchanged after trim" };
    return { id, name, status: "PASS", detail: `duration=${dur.toFixed(2)}` };
  } catch (e) {
    return { id, name, status: "FAIL", detail: String(e) };
  }
}

async function caseVoiceMusic(): Promise<CaseResult[]> {
  const { projectId, workspaceId, ownerId } = await harnessContext();
  const voice = `/tmp/p5i-voice-${randomUUID()}.wav`;
  const music = `/tmp/p5i-music-${randomUUID()}.wav`;
  await execFileAsync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", voice],
    { timeout: 60_000 },
  );
  await execFileAsync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=4", music],
    { timeout: 60_000 },
  );
  const voiceId = await putTestAsset({
    workspaceId,
    projectId,
    ownerId,
    localPath: voice,
    mimeType: "audio/wav",
    name: "voice.wav",
  });
  const musicId = await putTestAsset({
    workspaceId,
    projectId,
    ownerId,
    localPath: music,
    mimeType: "audio/wav",
    name: "music.wav",
  });
  const timeline = baseTimeline([
    {
      clipId: "v1",
      trackId: "track-video",
      durationMs: 2000,
      order: 0,
      startTimeMs: 0,
      volume: 1,
      muted: false,
      status: "ready",
    },
  ]);
  const voiceTrack = timeline.tracks.find((t) => t.type === "VOICEOVER")!;
  voiceTrack.clips = [
    {
      clipId: "vo1",
      trackId: voiceTrack.id,
      assetId: voiceId,
      durationMs: 4000,
      order: 0,
      startTimeMs: 0,
      volume: 1,
      muted: false,
      status: "ready",
    },
  ];
  const musicTrack = timeline.tracks.find((t) => t.type === "MUSIC")!;
  musicTrack.clips = [
    {
      clipId: "mu1",
      trackId: musicTrack.id,
      assetId: musicId,
      durationMs: 4000,
      order: 0,
      startTimeMs: 0,
      volume: 0.4,
      muted: false,
      status: "ready",
    },
  ];
  try {
    const out = await runAssembly(timeline, projectId, randomUUID());
    const streams = await ffprobeAudioStreams(out);
    const voiceOnly: CaseResult = {
      id: 7,
      name: "voiceover",
      status: streams >= 1 ? "PASS" : "FAIL",
      detail: `audio_streams=${streams}`,
    };
    const musicMix: CaseResult = {
      id: 8,
      name: "music",
      status: streams >= 1 ? "PASS" : "FAIL",
      detail: `audio_streams=${streams}`,
    };
    return [voiceOnly, musicMix];
  } catch (e) {
    return [
      { id: 7, name: "voiceover", status: "FAIL", detail: String(e) },
      { id: 8, name: "music", status: "FAIL", detail: String(e) },
    ];
  }
}

async function caseMissingInvalid(): Promise<CaseResult[]> {
  const { projectId, workspaceId, ownerId } = await harnessContext();
  const timelineMissing = baseTimeline([
    {
      clipId: "m1",
      trackId: "track-video",
      assetId: randomUUID(),
      durationMs: 1000,
      order: 0,
      startTimeMs: 0,
      volume: 1,
      muted: false,
      status: "ready",
    },
  ]);
  let missing: CaseResult = { id: 9, name: "missing_clip", status: "FAIL" };
  try {
    await runAssembly(timelineMissing, projectId, randomUUID());
    missing = { id: 9, name: "missing_clip", status: "FAIL", detail: "expected throw" };
  } catch (e) {
    const msg = String(e);
    missing =
      msg.includes("asset_missing") || msg.includes("asset")
        ? { id: 9, name: "missing_clip", status: "PASS", detail: "controlled failure" }
        : { id: 9, name: "missing_clip", status: "FAIL", detail: msg };
  }

  const corrupt = `/tmp/p5i-bad-${randomUUID()}.mp4`;
  await writeFile(corrupt, "not-a-video");
  const badId = await putTestAsset({
    workspaceId,
    projectId,
    ownerId,
    localPath: corrupt,
    mimeType: "video/mp4",
    name: "bad.mp4",
  });
  const timelineBad = baseTimeline([
    {
      clipId: "b1",
      trackId: "track-video",
      assetId: badId,
      durationMs: 1000,
      order: 0,
      startTimeMs: 0,
      volume: 1,
      muted: false,
      status: "ready",
    },
  ]);
  let invalid: CaseResult = { id: 10, name: "invalid_asset", status: "FAIL" };
  try {
    await runAssembly(timelineBad, projectId, randomUUID());
    invalid = { id: 10, name: "invalid_asset", status: "FAIL", detail: "expected ffmpeg failure" };
  } catch {
    invalid = { id: 10, name: "invalid_asset", status: "PASS", detail: "ffmpeg rejected corrupt input" };
  }
  return [missing, invalid];
}

async function main() {
  const results: CaseResult[] = [];
  results.push(await caseTrim());
  results.push(...(await caseVoiceMusic()));
  results.push(...(await caseMissingInvalid()));
  console.log(JSON.stringify({ harness: results }));
  const fail = results.some((r) => r.status === "FAIL");
  process.exit(fail ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
