import { HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createS3Client } from "@shotbro/config/s3";
import { createDb } from "@shotbro/db/client";
import { asset } from "@shotbro/db/schema";
import { eq, isNull } from "drizzle-orm";

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

const RECONCILE_PREFIX = "workspaces/";
const MAX_RECONCILE_ASSETS = Number(process.env.STORAGE_RECONCILE_MAX_ASSETS ?? "500");
const MAX_RECONCILE_LIST = Number(process.env.STORAGE_RECONCILE_MAX_LIST ?? "500");

/** Report DB assets missing in S3 and S3 keys under workspaces/ with no active asset row (never deletes user objects). */
export async function runStorageReconcile(log: { info: (o: unknown, msg?: string) => void }) {
  const dryRun = process.env.STORAGE_RECONCILE_DRY_RUN === "true";
  log.info({ dryRun }, "storage.reconcile start (report-only)");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const { db } = createDb(url);
  const env = s3Env();
  const s3 = createS3Client(env);

  const rows = await db
    .select({ id: asset.id, storageKey: asset.storageKey, status: asset.status })
    .from(asset)
    .where(isNull(asset.deletedAt))
    .limit(MAX_RECONCILE_ASSETS);

  let missingInS3 = 0;
  for (const row of rows) {
    if (row.status === "UPLOADING") continue;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: row.storageKey }));
    } catch {
      missingInS3++;
      log.info({ assetId: row.id, key: row.storageKey }, "asset row without S3 object");
    }
  }

  const keys = new Set(rows.map((r) => r.storageKey));
  let orphanedKeys = 0;
  let token: string | undefined;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: RECONCILE_PREFIX,
        MaxKeys: MAX_RECONCILE_LIST,
        ContinuationToken: token,
      }),
    );
    for (const obj of listed.Contents ?? []) {
      if (!obj.Key || !obj.Key.includes("/original/")) continue;
      if (!keys.has(obj.Key)) {
        orphanedKeys++;
        log.info({ key: obj.Key }, "orphaned S3 object (no active asset)");
      }
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);

  return { checkedAssets: rows.length, missingInS3, orphanedKeys };
}
