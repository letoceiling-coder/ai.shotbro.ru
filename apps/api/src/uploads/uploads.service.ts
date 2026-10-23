import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { createS3Client } from "@shotbro/config/s3";
import type { Db } from "@shotbro/db/client";
import { asset, uploadSession } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { loadApiEnv } from "../env";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

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

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
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

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: storageKey,
        ContentType: input.mimeType,
      }),
      { expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS },
    );

    return { sessionId, assetId, uploadUrl, storageKey, expiresAt: expiresAt.toISOString() };
  }

  async complete(userId: string, sessionId: string) {
    const [session] = await this.db.select().from(uploadSession).where(eq(uploadSession.id, sessionId)).limit(1);
    if (!session || session.ownerId !== userId) throw new BadRequestException("Invalid session");
    if (session.status !== "INIT" && session.status !== "UPLOADING") {
      throw new BadRequestException("Session not active");
    }
    if (session.expiresAt < new Date()) throw new BadRequestException("Session expired");

    await this.access.assertProjectAccess(this.db, userId, session.projectId);

    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: session.storageKey }),
    );
    const size = head.ContentLength ?? 0;
    if (size > session.maxSizeBytes) throw new BadRequestException("Uploaded object too large");

    await this.db
      .update(uploadSession)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(uploadSession.id, sessionId));
    await this.db
      .update(asset)
      .set({ status: "PROCESSING", sizeBytes: size })
      .where(eq(asset.id, session.assetId!));

    return { assetId: session.assetId, status: "PROCESSING" as const };
  }
}
