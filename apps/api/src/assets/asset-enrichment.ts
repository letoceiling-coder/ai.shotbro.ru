import {
  ReferenceLinkSchema,
  parseStoryboardDocument,
  parseTimelineDocument,
  type StoryboardScene,
} from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { and, eq, isNull } from "drizzle-orm";
import { asset, productionDocument, productionGraphNode, projectMemory } from "@shotbro/db/schema";

export type AssetRoleTag =
  | "upload"
  | "reference"
  | "first_frame"
  | "last_frame"
  | "generation"
  | "final"
  | "audio"
  | "video"
  | "image";

export type ProjectAssetIndex = {
  referenceByAsset: Map<string, Array<{ linkId: string; role: string }>>;
  storyboardByAsset: Map<string, Array<{ sceneId: string; field: string }>>;
  timelineByAsset: Map<string, Array<{ clipId: string }>>;
  graphByAsset: Map<string, Array<{ nodeId: string; nodeType: string; providerId?: string }>>;
  generationAssets: Set<string>;
  finalAssets: Set<string>;
};

const LINKS_KEY = "referenceLinks";

export async function loadProjectAssetIndex(db: Db, projectId: string): Promise<ProjectAssetIndex> {
  const referenceByAsset = new Map<string, Array<{ linkId: string; role: string }>>();
  const storyboardByAsset = new Map<string, Array<{ sceneId: string; field: string }>>();
  const timelineByAsset = new Map<string, Array<{ clipId: string }>>();
  const graphByAsset = new Map<string, Array<{ nodeId: string; nodeType: string; providerId?: string }>>();
  const generationAssets = new Set<string>();
  const finalAssets = new Set<string>();

  const [mem] = await db.select().from(projectMemory).where(eq(projectMemory.projectId, projectId)).limit(1);
  const prefs = (mem?.preferences ?? {}) as Record<string, unknown>;
  const rawLinks = prefs[LINKS_KEY];
  if (Array.isArray(rawLinks)) {
    for (const r of rawLinks) {
      try {
        const link = ReferenceLinkSchema.parse(r);
        const arr = referenceByAsset.get(link.assetId) ?? [];
        arr.push({ linkId: link.id, role: link.role });
        referenceByAsset.set(link.assetId, arr);
      } catch {
        /* skip invalid */
      }
    }
  }

  const [sbRow] = await db
    .select()
    .from(productionDocument)
    .where(
      and(
        eq(productionDocument.projectId, projectId),
        eq(productionDocument.docType, "STORYBOARD"),
        eq(productionDocument.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (sbRow) {
    try {
      const doc = parseStoryboardDocument(sbRow.payload);
      for (const scene of doc.scenes as StoryboardScene[]) {
        if (scene.firstFrameAssetId) {
          const arr = storyboardByAsset.get(scene.firstFrameAssetId) ?? [];
          arr.push({ sceneId: scene.sceneId, field: "firstFrameAssetId" });
          storyboardByAsset.set(scene.firstFrameAssetId, arr);
        }
        if (scene.lastFrameAssetId) {
          const arr = storyboardByAsset.get(scene.lastFrameAssetId) ?? [];
          arr.push({ sceneId: scene.sceneId, field: "lastFrameAssetId" });
          storyboardByAsset.set(scene.lastFrameAssetId, arr);
        }
      }
    } catch {
      /* legacy payload */
    }
  }

  const [tlRow] = await db
    .select()
    .from(productionDocument)
    .where(
      and(
        eq(productionDocument.projectId, projectId),
        eq(productionDocument.docType, "TIMELINE"),
        eq(productionDocument.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (tlRow) {
    try {
      const doc = parseTimelineDocument(tlRow.payload);
      for (const track of doc.tracks) {
        for (const clip of track.clips) {
          if (!clip.assetId) continue;
          const arr = timelineByAsset.get(clip.assetId) ?? [];
          arr.push({ clipId: clip.id });
          timelineByAsset.set(clip.assetId, arr);
        }
      }
    } catch {
      /* skip */
    }
  }

  const graphNodes = await db
    .select()
    .from(productionGraphNode)
    .where(eq(productionGraphNode.projectId, projectId));
  for (const node of graphNodes) {
    for (const aid of node.outputAssetIds ?? []) {
      generationAssets.add(aid);
      const arr = graphByAsset.get(aid) ?? [];
      arr.push({ nodeId: node.id, nodeType: node.nodeType, providerId: node.providerId ?? undefined });
      graphByAsset.set(aid, arr);
      if (node.nodeType === "FINAL_ASSEMBLY" || node.nodeType === "DELIVERY") {
        finalAssets.add(aid);
      }
    }
  }

  const deliveryCandidates = await db
    .select({ id: asset.id, originalName: asset.originalName, mimeType: asset.mimeType })
    .from(asset)
    .where(and(eq(asset.projectId, projectId), isNull(asset.deletedAt)));
  for (const row of deliveryCandidates) {
    if (row.mimeType === "video/mp4" && /mock-delivery|final-/i.test(row.originalName)) {
      finalAssets.add(row.id);
    }
  }

  return {
    referenceByAsset,
    storyboardByAsset,
    timelineByAsset,
    graphByAsset,
    generationAssets,
    finalAssets,
  };
}

export function rolesForAsset(
  row: { id: string; category: string; mimeType: string },
  index: ProjectAssetIndex,
): AssetRoleTag[] {
  const roles = new Set<AssetRoleTag>();
  if (row.mimeType.startsWith("image/")) roles.add("image");
  if (row.mimeType.startsWith("video/")) roles.add("video");
  if (row.mimeType.startsWith("audio/")) roles.add("audio");
  if (row.category === "upload") roles.add("upload");
  if (index.referenceByAsset.has(row.id)) roles.add("reference");
  if (index.storyboardByAsset.get(row.id)?.some((s) => s.field === "firstFrameAssetId")) roles.add("first_frame");
  if (index.storyboardByAsset.get(row.id)?.some((s) => s.field === "lastFrameAssetId")) roles.add("last_frame");
  if (index.generationAssets.has(row.id) || row.category === "provider_mock") roles.add("generation");
  if (index.finalAssets.has(row.id)) roles.add("final");
  return [...roles];
}

export function sourceLabel(category: string, graph?: Array<{ nodeType: string; providerId?: string }>): string {
  if (category === "upload") return "Загрузка пользователя";
  if (category === "provider_mock") return "Mock-генерация";
  if (graph?.length) {
    const n = graph[0]!;
    return n.providerId ? `Генерация · ${n.providerId}` : `Production · ${n.nodeType}`;
  }
  return "Проект";
}

export function previewStorageKey(storageKey: string, mimeType: string): string | null {
  if (mimeType.startsWith("image/")) {
    return storageKey.replace("/original/", "/thumb/");
  }
  if (mimeType.startsWith("video/")) {
    return storageKey.replace("/original/", "/poster/").replace(/\.[^.]+$/, ".jpg");
  }
  return null;
}
