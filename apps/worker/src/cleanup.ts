import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  ListMultipartUploadsCommand,
} from "@aws-sdk/client-s3";
import { createS3Client } from "@shotbro/config/s3";
import { createDb } from "@shotbro/db/client";
import { asset, uploadSession } from "@shotbro/db/schema";
import { and, eq, inArray, lt } from "drizzle-orm";

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

/** Expire stale upload sessions and abort orphaned multipart uploads. */
export async function runMediaCleanup(log: { info: (o: unknown, msg?: string) => void }) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const { db } = createDb(url);
  const env = s3Env();
  const s3 = createS3Client(env);
  const now = new Date();

  const stale = await db
    .select()
    .from(uploadSession)
    .where(
      and(
        lt(uploadSession.expiresAt, now),
        inArray(uploadSession.status, ["INIT", "UPLOADING"]),
      ),
    )
    .limit(200);

  let expired = 0;
  let aborted = 0;
  for (const row of stale) {
    if (row.multipartUploadId) {
      try {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: env.S3_BUCKET,
            Key: row.storageKey,
            UploadId: row.multipartUploadId,
          }),
        );
        aborted++;
      } catch (e) {
        log.info({ sessionId: row.id, err: String(e) }, "multipart abort failed");
      }
    } else if (row.assetId) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: row.storageKey }));
      } catch {
        /* object may not exist */
      }
      await db
        .update(asset)
        .set({ status: "DELETED", deletedAt: now })
        .where(eq(asset.id, row.assetId));
    }
    await db
      .update(uploadSession)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(eq(uploadSession.id, row.id));
    expired++;
  }

  const failed = await db
    .select()
    .from(uploadSession)
    .where(and(eq(uploadSession.status, "FAILED"), lt(uploadSession.updatedAt, new Date(now.getTime() - 86400_000))))
    .limit(50);
  for (const row of failed) {
    if (row.multipartUploadId) {
      try {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: env.S3_BUCKET,
            Key: row.storageKey,
            UploadId: row.multipartUploadId,
          }),
        );
      } catch {
        /* ignore */
      }
    }
  }

  try {
    const mp = await s3.send(new ListMultipartUploadsCommand({ Bucket: env.S3_BUCKET, MaxUploads: 50 }));
    for (const u of mp.Uploads ?? []) {
      if (!u.Key || !u.UploadId) continue;
      const age = u.Initiated ? now.getTime() - u.Initiated.getTime() : 0;
      if (age < 86_400_000) continue;
      const known = await db
        .select({ id: uploadSession.id })
        .from(uploadSession)
        .where(eq(uploadSession.multipartUploadId, u.UploadId))
        .limit(1);
      if (known.length) continue;
      await s3.send(
        new AbortMultipartUploadCommand({ Bucket: env.S3_BUCKET, Key: u.Key, UploadId: u.UploadId }),
      );
      aborted++;
    }
  } catch (e) {
    log.info({ err: String(e) }, "list multipart uploads skipped");
  }

  return { expired, aborted };
}
