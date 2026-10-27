import { z } from "zod";

export const AssetRoleTagSchema = z.enum([
  "upload",
  "reference",
  "first_frame",
  "last_frame",
  "generation",
  "final",
  "audio",
  "video",
  "image",
]);

export const AssetSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  mimeType: z.string(),
  originalName: z.string(),
  sizeBytes: z.number(),
  status: z.string(),
  category: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  createdAt: z.string(),
  roles: z.array(AssetRoleTagSchema),
  sceneIds: z.array(z.string()),
  source: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
});

export const AssetListResponseSchema = z.object({
  items: z.array(AssetSummarySchema),
  nextCursor: z.string().nullable().optional(),
});

export const AssetLineageNodeSchema = z.object({
  assetId: z.string(),
  relationType: z.string(),
  originalName: z.string().optional(),
  depth: z.number(),
});

export const AssetDetailSchema = AssetSummarySchema.extend({
  checksum: z.string().nullable().optional(),
  lineage: z.array(AssetLineageNodeSchema),
  versions: z.array(
    z.object({
      id: z.string(),
      version: z.number(),
      createdAt: z.string(),
    }),
  ),
  dependencies: z.object({
    storyboardScenes: z.array(z.object({ sceneId: z.string(), field: z.string() })),
    timelineClips: z.array(z.object({ clipId: z.string() })),
    referenceLinks: z.array(z.object({ linkId: z.string(), role: z.string() })),
    graphNodes: z.array(z.object({ nodeId: z.string(), nodeType: z.string() })),
  }),
});

export type AssetSummary = z.infer<typeof AssetSummarySchema>;
export type AssetDetail = z.infer<typeof AssetDetailSchema>;
