import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createS3Client, createS3SigningClient } from "@shotbro/config/s3";
import type { Db } from "@shotbro/db/client";
import { asset, assetVersion } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { loadApiEnv } from "../env";

@Injectable()
export class AssetsService {
  private readonly env = loadApiEnv();
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
  ) {}

  async listForProject(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = await this.db
      .select()
      .from(asset)
      .where(and(eq(asset.projectId, projectId), isNull(asset.deletedAt)))
      .orderBy(desc(asset.createdAt))
      .limit(100);
    return rows.map((a) => ({
      id: a.id,
      mimeType: a.mimeType,
      originalName: a.originalName,
      sizeBytes: a.sizeBytes,
      status: a.status,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async downloadUrl(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    const url = await getSignedUrl(
      this.s3Sign,
      new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: row.storageKey }),
      { expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS },
    );
    return { url, expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS };
  }

  async softDelete(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    await this.db
      .update(asset)
      .set({ status: "DELETED", deletedAt: new Date() })
      .where(eq(asset.id, assetId));
    return { id: assetId, status: "DELETED" as const };
  }

  async restore(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    await this.db
      .update(asset)
      .set({ status: "READY", deletedAt: null })
      .where(eq(asset.id, assetId));
    return { id: assetId, status: "READY" as const };
  }

  async listVersions(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    const versions = await this.db
      .select()
      .from(assetVersion)
      .where(eq(assetVersion.assetId, assetId))
      .orderBy(desc(assetVersion.version));
    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      storageKey: v.storageKey,
      createdAt: v.createdAt.toISOString(),
    }));
  }
}
