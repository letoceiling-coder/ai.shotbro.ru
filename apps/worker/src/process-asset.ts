import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "@shotbro/config/s3";
import { createDb } from "@shotbro/db/client";
import { asset, eventLog } from "@shotbro/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

function s3Env() {
  return {
    S3_ENDPOINT: process.env.S3_ENDPOINT!,
    S3_REGION: process.env.S3_REGION ?? "us-east-1",
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
    S3_BUCKET: process.env.S3_BUCKET!,
  };
}

async function appendEvent(
  db: ReturnType<typeof createDb>["db"],
  input: { workspaceId: string; projectId: string; type: string; resourceId: string; payload: Record<string, unknown> },
) {
  await db.insert(eventLog).values({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    resourceId: input.resourceId,
    type: input.type,
    payload: input.payload,
  });
}

export async function processAssetMetadata(assetId: string, log: { info: (o: unknown, msg?: string) => void }) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const { db } = createDb(url);
  const env = s3Env();
  const s3 = createS3Client(env);

  const [row] = await db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
  if (!row || row.status === "DELETED") return { skipped: true };

  await db.update(asset).set({ status: "PROCESSING" }).where(eq(asset.id, assetId));
  await appendEvent(db, {
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    type: "media.processing",
    resourceId: assetId,
    payload: { assetId, status: "PROCESSING" },
  });

  const got = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: row.storageKey }));
  if (!("Body" in got) || !got.Body) throw new Error("S3 object missing body");
  const body = Buffer.from(await got.Body.transformToByteArray());

  let width: number | undefined;
  let height: number | undefined;
  let durationMs: number | undefined;

  if (row.mimeType.startsWith("image/")) {
    const meta = await sharp(body).metadata();
    width = meta.width;
    height = meta.height;
    const thumbKey = row.storageKey.replace("/original/", "/thumb/");
    const thumb = await sharp(body).resize(320, 320, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: thumbKey,
        Body: thumb,
        ContentType: "image/jpeg",
      }),
    );
  } else if (row.mimeType.startsWith("video/") || row.mimeType.startsWith("audio/")) {
    log.info({ assetId, mime: row.mimeType }, "media metadata: non-image (poster/ffprobe in follow-up job)");
  }

  await db
    .update(asset)
    .set({ status: "READY", width, height, durationMs })
    .where(eq(asset.id, assetId));

  await appendEvent(db, {
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    type: "media.completed",
    resourceId: assetId,
    payload: { assetId, status: "READY", width, height, durationMs },
  });

  return { assetId, status: "READY" };
}
