import { z } from "zod";

/**
 * Phase 6E — scene canvas («Сцены»). The canvas is a view over the storyboard:
 * scene-derived nodes keep only `sceneId` and read their text from the active STORYBOARD,
 * so edits in the storyboard show up on the canvas and vice versa.
 */

export const CanvasNodeKindSchema = z.enum([
  "prompt",
  "asset",
  "character",
  "avatar",
  "voice",
  "first_frame",
  "scene_video",
  "avatar_video",
  "tts",
  "upscale",
  "assembly",
  "output",
]);
export type CanvasNodeKind = z.infer<typeof CanvasNodeKindSchema>;

export const CanvasPortTypeSchema = z.enum(["text", "image", "video", "audio", "avatar", "voice", "character"]);
export type CanvasPortType = z.infer<typeof CanvasPortTypeSchema>;

/** Nodes that produce media through a provider (paid outside mock mode, except assembly). */
export const RUNNABLE_CANVAS_KINDS = ["first_frame", "scene_video", "avatar_video", "tts", "upscale", "assembly"] as const;
export type RunnableCanvasKind = (typeof RUNNABLE_CANVAS_KINDS)[number];

export function isRunnableCanvasKind(kind: string): kind is RunnableCanvasKind {
  return (RUNNABLE_CANVAS_KINDS as readonly string[]).includes(kind);
}

/** Port colours in the UI follow these types. `asset` output depends on the asset's media type. */
export const CANVAS_NODE_PORTS: Record<CanvasNodeKind, { accepts: CanvasPortType[]; output: CanvasPortType | null }> = {
  prompt: { accepts: [], output: "text" },
  asset: { accepts: [], output: "image" },
  character: { accepts: [], output: "character" },
  avatar: { accepts: [], output: "avatar" },
  voice: { accepts: [], output: "voice" },
  first_frame: { accepts: ["text", "image"], output: "image" },
  scene_video: { accepts: ["image", "text"], output: "video" },
  avatar_video: { accepts: ["avatar", "character", "text", "audio", "voice"], output: "video" },
  tts: { accepts: ["text", "voice", "character"], output: "audio" },
  upscale: { accepts: ["image"], output: "image" },
  assembly: { accepts: ["video", "audio"], output: "video" },
  output: { accepts: ["video"], output: null },
};

export const CANVAS_NODE_LABEL: Record<CanvasNodeKind, string> = {
  prompt: "Текст / промпт",
  asset: "Материал",
  character: "Персонаж",
  avatar: "Аватар",
  voice: "Голос",
  first_frame: "Первый кадр",
  scene_video: "Видео сцены",
  avatar_video: "Видео с аватаром",
  tts: "Озвучка",
  upscale: "Апскейл",
  assembly: "Монтаж",
  output: "Выдача",
};

export const CanvasMediaTypeSchema = z.enum(["image", "video", "audio"]);

export const CanvasNodeDataSchema = z.object({
  label: z.string().max(120).optional(),
  /** Free text for user-added prompt nodes (scene prompt nodes read the storyboard instead). */
  text: z.string().max(2500).optional(),
  assetId: z.string().optional(),
  mediaType: CanvasMediaTypeSchema.optional(),
  characterId: z.string().optional(),
  avatarProfileId: z.string().optional(),
  avatarLookId: z.string().optional(),
  voiceProfileId: z.string().optional(),
  durationSeconds: z.number().positive().max(10).optional(),
});
export type CanvasNodeData = z.infer<typeof CanvasNodeDataSchema>;

export const CanvasNodeSchema = z.object({
  id: z.string().min(1).max(120),
  kind: CanvasNodeKindSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  /** Scene-derived node (created from the storyboard). */
  sceneId: z.string().optional(),
  data: CanvasNodeDataSchema.default({}),
});
export type CanvasNode = z.infer<typeof CanvasNodeSchema>;

export const CanvasEdgeSchema = z.object({
  id: z.string().min(1).max(260),
  source: z.string(),
  target: z.string(),
});
export type CanvasEdge = z.infer<typeof CanvasEdgeSchema>;

export const CanvasViewportSchema = z.object({ x: z.number(), y: z.number(), zoom: z.number().min(0.05).max(4) });

export const SceneCanvasPayloadSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  nodes: z.array(CanvasNodeSchema).max(400),
  edges: z.array(CanvasEdgeSchema).max(800),
  viewport: CanvasViewportSchema.default({ x: 0, y: 0, zoom: 0.8 }),
});
export type SceneCanvasPayload = z.infer<typeof SceneCanvasPayloadSchema>;

export const SaveCanvasInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nodes: z.array(CanvasNodeSchema).max(400),
  edges: z.array(CanvasEdgeSchema).max(800),
  viewport: CanvasViewportSchema,
});
export type SaveCanvasInput = z.infer<typeof SaveCanvasInputSchema>;

export const CanvasRunStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]);

export const CanvasNodeRunSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  status: CanvasRunStatusSchema,
  assetId: z.string().nullable(),
  mimeType: z.string().nullable(),
  providerId: z.string(),
  failureCode: z.string().nullable(),
  approvalId: z.string().nullable(),
  mock: z.boolean(),
  createdAt: z.string(),
});
export type CanvasNodeRun = z.infer<typeof CanvasNodeRunSchema>;

export const CanvasSceneSummarySchema = z.object({
  sceneId: z.string(),
  order: z.number(),
  title: z.string(),
  durationSeconds: z.number(),
  firstFramePrompt: z.string(),
  videoMotionPrompt: z.string().optional(),
  narration: z.string().optional(),
  revision: z.number(),
});

export const SceneCanvasViewSchema = z.object({
  documentId: z.string(),
  version: z.number().int(),
  payload: SceneCanvasPayloadSchema,
  storyboardVersion: z.number().int().nullable(),
  scenes: z.array(CanvasSceneSummarySchema),
  /** Scene ids referenced by nodes but no longer present in the storyboard. */
  orphanSceneIds: z.array(z.string()),
  runs: z.record(z.array(CanvasNodeRunSchema)),
  mock: z.boolean(),
});
export type SceneCanvasView = z.infer<typeof SceneCanvasViewSchema>;

export const CanvasQuoteInputSchema = z.object({
  nodeIds: z.array(z.string()).min(1).max(60),
  conversationId: z.string().uuid().optional(),
});
export type CanvasQuoteInput = z.infer<typeof CanvasQuoteInputSchema>;

export const CanvasQuoteItemSchema = z.object({
  nodeId: z.string(),
  kind: CanvasNodeKindSchema,
  providerId: z.string(),
  estimatedLiveUsd: z.number(),
  chargedUsd: z.number(),
  note: z.string(),
});
export type CanvasQuoteItem = z.infer<typeof CanvasQuoteItemSchema>;

export const CanvasQuoteResultSchema = z.object({
  approvalId: z.string(),
  messageId: z.string(),
  payloadHash: z.string(),
  targetVersion: z.string(),
  items: z.array(CanvasQuoteItemSchema),
  totalEstimatedLiveUsd: z.number(),
  totalChargedUsd: z.number(),
  mock: z.boolean(),
});
export type CanvasQuoteResult = z.infer<typeof CanvasQuoteResultSchema>;

/** Which output type a node exposes (asset nodes expose their media type). */
export function canvasOutputType(node: Pick<CanvasNode, "kind" | "data">): CanvasPortType | null {
  if (node.kind === "asset") return node.data?.mediaType ?? "image";
  return CANVAS_NODE_PORTS[node.kind].output;
}

/** Connection rule shared by the UI (drag validation) and the API (save validation). */
export function canConnectCanvasNodes(
  source: Pick<CanvasNode, "kind" | "data">,
  target: Pick<CanvasNode, "kind" | "data">,
): boolean {
  const out = canvasOutputType(source);
  if (!out) return false;
  return CANVAS_NODE_PORTS[target.kind].accepts.includes(out);
}

/** Deterministic ids for scene-derived nodes so repeated syncs never duplicate them. */
export const sceneCanvasNodeId = (sceneId: string, role: "prompt" | "frame" | "video" | "voice") => `scene:${sceneId}:${role}`;
export const CANVAS_ASSEMBLY_NODE_ID = "assembly";
export const CANVAS_OUTPUT_NODE_ID = "output";
