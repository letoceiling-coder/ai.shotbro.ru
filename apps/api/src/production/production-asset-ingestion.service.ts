import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { createS3Client } from "@shotbro/config/s3";
import { ProductionAssetIngestionService as IngestionGuard } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { asset, assetVersion } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { AssetsService } from "../assets/assets.service";
import { loadApiEnv } from "../env";

@Injectable()
export class ProductionAssetIngestionService {
  private readonly env = loadApiEnv();
  private readonly s3 = createS3Client({
    S3_ENDPOINT: this.env.S3_ENDPOINT,
    S3_REGION: this.env.S3_REGION,
    S3_ACCESS_KEY_ID: this.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: this.env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: this.env.S3_FORCE_PATH_STYLE ?? false,
  });
  private readonly guard = new IngestionGuard({
    maxBytes: 50 * 1024 * 1024,
    allowedMimePrefixes: ["image/", "video/", "audio/"],
    allowedHostnames: ["fixtures.shotbro.test", "ai.shotbro.ru"],
  });

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(AssetsService) private readonly assets: AssetsService,
  ) {}

  async ingestMockProviderOutput(input: {
    userId: string;
    projectId: string;
    workspaceId: string;
    sourceUrl: string;
    bytes: Buffer;
    mimeType: string;
    originalName: string;
    providerJobId: string;
    graphNodeId?: string;
    parentAssetIds?: string[];
  }) {
    await this.access.assertProjectAccess(this.db, input.userId, input.projectId);
    const validated = await this.guard.ingestFromFixture(
      {
        projectId: input.projectId,
        sourceUrl: input.sourceUrl,
        ownerId: input.userId,
      },
      { bytes: input.bytes, mimeType: input.mimeType },
    );
    if (!validated.ok) throw new Error(validated.reason ?? "ingestion_rejected");

    const assetId = uuid();
    const storageKey = `projects/${input.projectId}/provider/${input.providerJobId}/${assetId}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: storageKey,
        Body: input.bytes,
        ContentType: input.mimeType,
      }),
    );

    await this.db.insert(asset).values({
      id: assetId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      ownerId: input.userId,
      category: "provider_mock",
      mimeType: input.mimeType,
      originalName: input.originalName,
      storageKey,
      sizeBytes: input.bytes.length,
      checksum: validated.checksum,
      status: "READY",
    });
    await this.db.insert(assetVersion).values({
      id: uuid(),
      assetId,
      version: 1,
      storageKey,
      metadata: {
        mock: true,
        providerJobId: input.providerJobId,
        graphNodeId: input.graphNodeId,
      },
    });

    for (const parentId of input.parentAssetIds ?? []) {
      if (parentId && parentId !== assetId) {
        await this.assets.recordRelation(parentId, assetId, "generated_from");
      }
    }

    return { assetId, storageKey, mock: true as const };
  }
}
