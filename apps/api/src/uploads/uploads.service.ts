import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { isAllowedMime, mimeMatchesDeclared, sniffMime } from "@shotbro/config/mime-policy";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { createS3Client, createS3SigningClient } from "@shotbro/config/s3";
import type { Db } from "@shotbro/db/client";
import { asset, assetVersion, uploadSession } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { loadApiEnv } from "../env";
import { MediaQueueService } from "../queue/media-queue.service";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;
const MULTIPART_PART_SIZE = 5 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 100;

@Injectable()
export class UploadsService {
  private readonly env = loadApiEnv();
  private readonly s3 = createS3Client({
    S3_ENDPOINT: this.env.S3_ENDPOINT,
    S3_REGION: this.env.S3_REGION,
    S3_ACCESS_KEY_ID: this.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: this.env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: this.env.S3_FORCE_PATH_STYLE ?? false,
  });
  private readonly s3Sign = createS3SigningClient({
    S3_ENDPOINT: this.env.S3_ENDPOINT,
    S3_PUBLIC_ENDPOINT: this.env.S3_PUBLIC_ENDPOINT,
    S3_REGION: this.env.S3_REGION,
    S3_ACCESS_KEY_ID: this.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: this.env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: this.env.S3_FORCE_PATH_STYLE ?? false,
  });

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(MediaQueueService) private readonly mediaQueue: MediaQueueService,
  ) {}

  buildStorageKey(workspaceId: string, projectId: string, assetId: string, filename: string) {
    return `workspaces/${workspaceId}/projects/${projectId}/assets/${assetId}/original/${sanitizeFilename(filename)}`;
  }

  async init(
    userId: string,
    input: { projectId: string; filename: string; mimeType: string; sizeBytes: number },
  ) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, input.projectId);
    const max = this.env.S3_MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    if (input.sizeBytes <= 0 || input.sizeBytes > max) {
      throw new BadRequestException("File size not allowed");
    }
    if (!isAllowedMime(input.mimeType)) {
      throw new BadRequestException("MIME type not allowed");
    }

    const assetId = uuid();
    const sessionId = uuid();
    const storageKey = this.buildStorageKey(workspaceId, input.projectId, assetId, input.filename);
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    await this.db.transaction(async (tx) => {
      await tx.insert(asset).values({
        id: assetId,
        workspaceId,
        projectId: input.projectId,
        ownerId: userId,
        mimeType: input.mimeType,
        originalName: input.filename,
        storageKey,
        sizeBytes: input.sizeBytes,
        status: "UPLOADING",
      });
      await tx.insert(uploadSession).values({
        id: sessionId,
        workspaceId,
        projectId: input.projectId,
        ownerId: userId,
        assetId,
        storageKey,
        expectedMime: input.mimeType,
        maxSizeBytes: input.sizeBytes,
        status: "INIT",
        expiresAt,
      });
    });

    if (input.sizeBytes >= MULTIPART_THRESHOLD_BYTES) {
      const mp = await this.s3.send(
        new CreateMultipartUploadCommand({
          Bucket: this.env.S3_BUCKET,
          Key: storageKey,
          ContentType: input.mimeType,
        }),
      );
      if (!mp.UploadId) throw new BadRequestException("Multipart init failed");
      await this.db
        .update(uploadSession)
        .set({ multipartUploadId: mp.UploadId, status: "UPLOADING" })
        .where(eq(uploadSession.id, sessionId));

      const partCount = Math.min(
        MAX_MULTIPART_PARTS,
        Math.ceil(input.sizeBytes / MULTIPART_PART_SIZE),
      );
      const parts = await Promise.all(
        Array.from({ length: partCount }, async (_, i) => {
          const partNumber = i + 1;
          const uploadUrl = await getSignedUrl(
            this.s3Sign,
            new UploadPartCommand({
              Bucket: this.env.S3_BUCKET,
              Key: storageKey,
              UploadId: mp.UploadId,
              PartNumber: partNumber,
            }),
            { expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS },
          );
          return { partNumber, uploadUrl };
        }),
      );

      return {
        mode: "multipart" as const,
        sessionId,
        assetId,
        storageKey,
        uploadId: mp.UploadId,
        partSize: MULTIPART_PART_SIZE,
        parts,
        expiresAt: expiresAt.toISOString(),
      };
    }

    const uploadUrl = await getSignedUrl(
      this.s3Sign,
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: storageKey,
        ContentType: input.mimeType,
      }),
      { expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS },
    );

    return {
      mode: "single" as const,
      sessionId,
      assetId,
      uploadUrl,
      storageKey,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async recordInitialVersion(assetId: string, storageKey: string) {
    await this.db.insert(assetVersion).values({
      id: uuid(),
      assetId,
      version: 1,
      storageKey,
      metadata: { source: "upload" },
    });
  }

  async complete(
    userId: string,
    sessionId: string,
    multipart?: { parts: Array<{ partNumber: number; etag: string }> },
  ) {
    const [session] = await this.db.select().from(uploadSession).where(eq(uploadSession.id, sessionId)).limit(1);
    if (!session || session.ownerId !== userId) throw new BadRequestException("Invalid session");
    if (session.status !== "INIT" && session.status !== "UPLOADING") {
      throw new BadRequestException("Session not active");
    }
    if (session.expiresAt < new Date()) throw new BadRequestException("Session expired");

    await this.access.assertProjectAccess(this.db, userId, session.projectId);

    if (session.multipartUploadId) {
      if (!multipart?.parts?.length) throw new BadRequestException("Multipart parts required");
      await this.s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.env.S3_BUCKET,
          Key: session.storageKey,
          UploadId: session.multipartUploadId,
          MultipartUpload: {
            Parts: multipart.parts
              .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
              .sort((a, b) => a.PartNumber - b.PartNumber),
          },
        }),
      );
    }

    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: session.storageKey }),
    );
    const size = head.ContentLength ?? 0;
    if (size > session.maxSizeBytes) throw new BadRequestException("Uploaded object too large");

    const probe = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: session.storageKey,
        Range: "bytes=0-511",
      }),
    );
    const chunk = Buffer.from(await probe.Body!.transformToByteArray());
    const sniffed = sniffMime(chunk);
    if (!mimeMatchesDeclared(session.expectedMime, sniffed)) {
      await this.db
        .update(asset)
        .set({ status: "QUARANTINED" })
        .where(eq(asset.id, session.assetId!));
      await this.db
        .update(uploadSession)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(uploadSession.id, sessionId));
      throw new BadRequestException("MIME verification failed");
    }

    await this.db
      .update(uploadSession)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(uploadSession.id, sessionId));
    await this.db
      .update(asset)
      .set({ status: "PROCESSING", sizeBytes: size })
      .where(eq(asset.id, session.assetId!));

    if (session.assetId) {
      await this.recordInitialVersion(session.assetId, session.storageKey);
      await this.mediaQueue.enqueueMediaProcessing(session.assetId);
    }

    return { assetId: session.assetId, status: "PROCESSING" as const };
  }
}
