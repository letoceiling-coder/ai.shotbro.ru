import {
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppEnv } from "./env.js";
import { safeErrorMessage } from "./redact.js";

export type S3ClientEnv = {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
};

/** Ensures bucket exists (staging MinIO bootstrap). No-op if HeadBucket succeeds. */
export async function ensureS3Bucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export function createS3Client(env: S3ClientEnv): S3Client {
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

const TEST_PREFIX = "__system/integration-check/";

export type S3LiveCheckResult = {
  headBucket: boolean;
  putObject: boolean;
  presignedUrl: boolean;
  getObject: boolean;
  deleteObject: boolean;
  multipart: boolean;
  corsConfigured: boolean | "unknown" | "denied";
  messages: string[];
};

export async function runS3LiveChecks(client: S3Client, bucket: string, ttlSeconds: number): Promise<S3LiveCheckResult> {
  const messages: string[] = [];
  const key = `${TEST_PREFIX}probe-${Date.now()}.txt`;
  const body = `shotbro-integration-check ${new Date().toISOString()}`;
  const result: S3LiveCheckResult = {
    headBucket: false,
    putObject: false,
    presignedUrl: false,
    getObject: false,
    deleteObject: false,
    multipart: false,
    corsConfigured: "unknown",
    messages,
  };

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    result.headBucket = true;
    messages.push("HeadBucket: OK");
  } catch (e) {
    messages.push(`HeadBucket: ${safeErrorMessage(e)}`);
  }

  try {
    const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    result.corsConfigured = (cors.CORSRules?.length ?? 0) > 0;
    messages.push(result.corsConfigured ? "CORS: rules present" : "CORS: no rules (configure before browser uploads)");
  } catch {
    result.corsConfigured = "denied";
    messages.push("CORS: cannot read (may need s3:GetBucketCORS — configure in panel if needed)");
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
        ServerSideEncryption: "AES256",
      }),
    );
    result.putObject = true;
    messages.push("PutObject: OK");
  } catch (e) {
    messages.push(`PutObject: ${safeErrorMessage(e)}`);
    return result;
  }

  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
    result.presignedUrl = url.startsWith("https://");
    messages.push(result.presignedUrl ? "Presigned URL: OK" : "Presigned URL: invalid");
  } catch (e) {
    messages.push(`Presigned URL: ${safeErrorMessage(e)}`);
  }

  try {
    const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await got.Body?.transformToString();
    result.getObject = text === body;
    messages.push(result.getObject ? "GetObject: OK" : "GetObject: content mismatch");
  } catch (e) {
    messages.push(`GetObject: ${safeErrorMessage(e)}`);
  }

  try {
    const mp = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: `${key}.mp`,
        ContentType: "text/plain",
      }),
    );
    const uploadId = mp.UploadId;
    if (uploadId) {
      await client.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: `${key}.mp`,
          UploadId: uploadId,
          PartNumber: 1,
          Body: "part1",
        }),
      );
      result.multipart = true;
      messages.push("Multipart upload (init + part): OK");
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `${key}.mp` }));
    }
  } catch (e) {
    messages.push(`Multipart: ${safeErrorMessage(e)}`);
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    result.deleteObject = true;
    messages.push("DeleteObject: OK (test object removed)");
  } catch (e) {
    messages.push(`DeleteObject: ${safeErrorMessage(e)}`);
  }

  return result;
}
