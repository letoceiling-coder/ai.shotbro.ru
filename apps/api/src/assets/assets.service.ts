import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createS3Client, createS3SigningClient } from "@shotbro/config/s3";
import type { Db } from "@shotbro/db/client";
import { asset, assetRelation, assetVersion } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { loadApiEnv } from "../env";
import {
  loadProjectAssetIndex,
  previewStorageKey,
  rolesForAsset,
  sourceLabel,
  type AssetRoleTag,
} from "./asset-enrichment";

type AssetRow = typeof asset.$inferSelect;

export type AssetListQuery = {
  limit?: number;
  cursor?: string;
  q?: string;
  sort?: "created_desc" | "created_asc" | "name_asc" | "size_desc";
  filter?: string;
};

@Injectable()
export class AssetsService {
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
  ) {}

  private mapLegacy(a: AssetRow) {
    return {
      id: a.id,
      mimeType: a.mimeType,
      originalName: a.originalName,
      sizeBytes: a.sizeBytes,
      status: a.status,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
      createdAt: a.createdAt.toISOString(),
      category: a.category,
    };
  }

  private mapSummary(a: AssetRow, index: Awaited<ReturnType<typeof loadProjectAssetIndex>>) {
    const graph = index.graphByAsset.get(a.id);
    return {
      id: a.id,
      projectId: a.projectId,
      mimeType: a.mimeType,
      originalName: a.originalName,
      sizeBytes: a.sizeBytes,
      status: a.status,
      category: a.category,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
      createdAt: a.createdAt.toISOString(),
      roles: rolesForAsset(a, index),
      sceneIds: [
        ...new Set((index.storyboardByAsset.get(a.id) ?? []).map((s) => s.sceneId)),
      ],
      source: sourceLabel(a.category, graph),
      providerId: graph?.[0]?.providerId,
    };
  }

  async listForProject(userId: string, projectId: string, query?: AssetListQuery) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const isLibraryQuery =
      Boolean(query?.limit || query?.cursor || query?.q || query?.filter || query?.sort);

    if (!isLibraryQuery) {
      const rows = await this.db
        .select()
        .from(asset)
        .where(and(eq(asset.projectId, projectId), isNull(asset.deletedAt)))
        .orderBy(desc(asset.createdAt))
        .limit(100);
      return rows.map((a) => this.mapLegacy(a));
    }

    const limit = Math.min(Math.max(query?.limit ?? 24, 1), 100);
    const index = await loadProjectAssetIndex(this.db, projectId);

    let rows = await this.db
      .select()
      .from(asset)
      .where(and(eq(asset.projectId, projectId), isNull(asset.deletedAt)))
      .orderBy(desc(asset.createdAt))
      .limit(500);

    if (query?.q?.trim()) {
      const q = query.q.trim().toLowerCase();
      rows = rows.filter((r) => r.originalName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }

    const filter = query?.filter ?? "all";
    if (filter !== "all") {
      rows = rows.filter((r) => {
        const roles = rolesForAsset(r, index);
        if (filter === "upload") return r.category === "upload";
        if (filter === "image") return r.mimeType.startsWith("image/");
        if (filter === "video") return r.mimeType.startsWith("video/");
        if (filter === "audio") return r.mimeType.startsWith("audio/");
        return roles.includes(filter as AssetRoleTag);
      });
    }

    switch (query?.sort) {
      case "created_asc":
        rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case "name_asc":
        rows.sort((a, b) => a.originalName.localeCompare(b.originalName));
        break;
      case "size_desc":
        rows.sort((a, b) => b.sizeBytes - a.sizeBytes);
        break;
      default:
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    if (query?.cursor) {
      const [cursorAt, cursorId] = query.cursor.split("|");
      const t = Date.parse(cursorAt ?? "");
      if (!Number.isNaN(t) && cursorId) {
        rows = rows.filter(
          (r) =>
            r.createdAt.getTime() < t || (r.createdAt.getTime() === t && r.id < cursorId),
        );
      }
    }

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? `${last.createdAt.toISOString()}|${last.id}`
        : null;

    return {
      items: page.map((a) => this.mapSummary(a, index)),
      nextCursor,
    };
  }

  async getDetail(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    const index = await loadProjectAssetIndex(this.db, row.projectId);
    const versions = await this.db
      .select()
      .from(assetVersion)
      .where(eq(assetVersion.assetId, assetId))
      .orderBy(desc(assetVersion.version));

    const lineage = await this.buildLineage(assetId);

    const meta = versions[0]?.metadata as Record<string, unknown> | undefined;

    return {
      ...this.mapSummary(row, index),
      checksum: row.checksum,
      modelId: typeof meta?.modelId === "string" ? meta.modelId : undefined,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        createdAt: v.createdAt.toISOString(),
      })),
      lineage,
      dependencies: {
        storyboardScenes: index.storyboardByAsset.get(assetId) ?? [],
        timelineClips: index.timelineByAsset.get(assetId) ?? [],
        referenceLinks: index.referenceByAsset.get(assetId) ?? [],
        graphNodes: index.graphByAsset.get(assetId) ?? [],
      },
    };
  }

  private async buildLineage(assetId: string, depth = 0, seen = new Set<string>()) {
    if (seen.has(assetId) || depth > 8) return [];
    seen.add(assetId);
    const edges = await this.db
      .select()
      .from(assetRelation)
      .where(eq(assetRelation.childAssetId, assetId));
    const out: Array<{
      assetId: string;
      relationType: string;
      originalName?: string;
      depth: number;
    }> = [];
    for (const edge of edges) {
      const [parent] = await this.db
        .select()
        .from(asset)
        .where(eq(asset.id, edge.parentAssetId))
        .limit(1);
      out.push({
        assetId: edge.parentAssetId,
        relationType: edge.relationType,
        originalName: parent?.originalName,
        depth: depth + 1,
      });
      const nested = await this.buildLineage(edge.parentAssetId, depth + 1, seen);
      out.push(...nested);
    }
    return out;
  }

  async recordRelation(parentAssetId: string, childAssetId: string, relationType: string) {
    if (parentAssetId === childAssetId) return;
    const existing = await this.db
      .select()
      .from(assetRelation)
      .where(
        and(
          eq(assetRelation.parentAssetId, parentAssetId),
          eq(assetRelation.childAssetId, childAssetId),
          eq(assetRelation.relationType, relationType),
        ),
      )
      .limit(1);
    if (existing[0]) return;
    await this.db.insert(assetRelation).values({ parentAssetId, childAssetId, relationType });
  }

  async signedUrlForKey(key: string) {
    return getSignedUrl(
      this.s3Sign,
      new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }),
      { expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS },
    );
  }

  async previewUrl(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    const previewKey = previewStorageKey(row.storageKey, row.mimeType);
    if (previewKey) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: previewKey }));
        const url = await this.signedUrlForKey(previewKey);
        return { url, kind: "preview" as const, expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS };
      } catch {
        /* fall through */
      }
    }
    if (row.mimeType.startsWith("image/")) {
      const url = await this.signedUrlForKey(row.storageKey);
      return { url, kind: "original" as const, expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS };
    }
    throw new NotFoundException("preview_not_available");
  }

  async downloadUrl(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    const url = await this.signedUrlForKey(row.storageKey);
    return { url, expiresIn: this.env.S3_PRESIGNED_URL_TTL_SECONDS };
  }

  async rename(userId: string, assetId: string, originalName: string) {
    const name = originalName.trim();
    if (!name || name.length > 120) throw new BadRequestException("invalid_name");
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    await this.db.update(asset).set({ originalName: name }).where(eq(asset.id, assetId));
    return { id: assetId, originalName: name };
  }

  async softDelete(userId: string, assetId: string) {
    const [row] = await this.db.select().from(asset).where(eq(asset.id, assetId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    const index = await loadProjectAssetIndex(this.db, row.projectId);
    const deps = {
      storyboard: index.storyboardByAsset.get(assetId) ?? [],
      timeline: index.timelineByAsset.get(assetId) ?? [],
      references: index.referenceByAsset.get(assetId) ?? [],
      graph: index.graphByAsset.get(assetId) ?? [],
    };
    if (deps.storyboard.length || deps.timeline.length || deps.references.length || deps.graph.length) {
      throw new ConflictException({ code: "asset_in_use", dependencies: deps });
    }
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
