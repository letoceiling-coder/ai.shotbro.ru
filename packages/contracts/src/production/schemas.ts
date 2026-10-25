import { z } from "zod";

export const ProductionDocumentStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "SUPERSEDED",
  "ARCHIVED",
]);

export const ProductionDocTypeSchema = z.enum([
  "BRIEF",
  "CREATIVE_CONCEPT",
  "PRODUCTION_PLAN",
  "SCRIPT",
  "STORYBOARD",
  "MODEL_SELECTION",
  "COST_ESTIMATE",
  "TIMELINE",
  "DELIVERY",
]);

export const ProductionBriefSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  goal: z.string(),
  targetAudience: z.string().optional(),
  format: z.string(),
  durationSeconds: z.number().int().positive(),
  aspectRatio: z.string(),
  style: z.string().optional(),
  brandName: z.string().optional(),
  constraints: z.array(z.string()).default([]),
  missingInfo: z.array(z.string()).default([]),
  mock: z.literal(true).optional(),
});

export const ProductionPlanSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  narrativeStructure: z.string(),
  deliverables: z.array(z.string()),
  approvalPoints: z.array(z.string()),
  modelStrategy: z.enum(["economy", "balance", "quality", "manual"]),
  estimatedBudgetUsd: z.number().min(0).optional(),
  mock: z.literal(true).optional(),
});

export const ScriptSceneStatusSchema = z.enum(["draft", "review", "approved", "locked"]);

export const ScriptScenePayloadSchema = z.object({
  id: z.string(),
  sequence: z.number().int(),
  title: z.string(),
  durationSeconds: z.number().positive(),
  description: z.string(),
  action: z.string().optional(),
  dialogue: z.string().optional(),
  voiceover: z.string().optional(),
  camera: z.string().optional(),
  lighting: z.string().optional(),
  location: z.string().optional(),
  characters: z.array(z.string()).default([]),
  visualStyle: z.string().optional(),
  transition: z.string().optional(),
  status: ScriptSceneStatusSchema.default("draft"),
  revision: z.number().int().positive().default(1),
  narration: z.string().optional(),
});

export const ScriptDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  title: z.string(),
  concept: z.string().optional(),
  format: z.string().optional(),
  style: z.string().optional(),
  targetAudience: z.string().optional(),
  toneOfVoice: z.string().optional(),
  synopsis: z.string().optional(),
  totalDurationSeconds: z.number().positive(),
  scenes: z.array(ScriptScenePayloadSchema).min(1),
  mock: z.literal(true).optional(),
});

export const StoryboardFrameSchema = z.object({
  sceneId: z.string(),
  sequence: z.number().int(),
  durationSeconds: z.number().positive(),
  visualDescription: z.string(),
  firstFramePrompt: z.string().max(2500),
  videoMotionPrompt: z.string().max(2500).optional(),
  narration: z.string().optional(),
});

export const StoryboardSceneStatusSchema = z.enum(["draft", "review", "approved", "locked"]);

export const ProductionStoryboardSceneSchema = z.object({
  sceneId: z.string(),
  order: z.number().int(),
  title: z.string(),
  description: z.string().default(""),
  durationSeconds: z.number().positive(),
  firstFrameAssetId: z.string().optional(),
  lastFrameAssetId: z.string().optional(),
  referenceAssetIds: z.array(z.string()).default([]),
  characterIds: z.array(z.string()).default([]),
  characterVersionById: z.record(z.number().int().positive()).default({}),
  imagePromptVersionId: z.string().optional(),
  videoPromptVersionId: z.string().optional(),
  imageModelSettings: z.record(z.unknown()).optional(),
  videoModelSettings: z.record(z.unknown()).optional(),
  cameraMotion: z.string().optional(),
  lighting: z.string().optional(),
  transition: z.string().optional(),
  status: StoryboardSceneStatusSchema.default("draft"),
  revision: z.number().int().positive().default(1),
  visualDescription: z.string().optional(),
  firstFramePrompt: z.string().max(2500).optional(),
  videoMotionPrompt: z.string().max(2500).optional(),
  narration: z.string().optional(),
});

export const ProductionStoryboardDocumentSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
  title: z.string(),
  scriptDocumentVersion: z.number().int().positive().optional(),
  frames: z.array(StoryboardFrameSchema).optional(),
  scenes: z.array(ProductionStoryboardSceneSchema).optional(),
  mock: z.literal(true).optional(),
});

export const ReferenceRoleSchema = z.enum([
  "CHARACTER",
  "STYLE",
  "FIRST_FRAME",
  "LAST_FRAME",
  "PRODUCT",
  "LOCATION",
  "CAMERA",
  "VOICE",
  "GENERAL",
]);

export const ReferenceLinkSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  assetId: z.string(),
  role: ReferenceRoleSchema,
  sceneId: z.string().optional(),
  characterId: z.string().optional(),
  revision: z.number().int().positive().default(1),
  createdAt: z.string(),
});

export const CharacterProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  appearance: z.string().optional(),
  wardrobe: z.string().optional(),
  visualStyle: z.string().optional(),
  voiceNotes: z.string().optional(),
  referenceAssetIds: z.array(z.string()).default([]),
  primaryReferenceAssetId: z.string().optional(),
  sceneIds: z.array(z.string()).default([]),
  version: z.number().int().positive().default(1),
  history: z.array(z.object({ version: z.number(), snapshot: z.record(z.unknown()) })).optional(),
});

/** Normalize v1 frames → v2 scenes for API consumers. */
export function parseStoryboardDocument(raw: unknown) {
  const base = ProductionStoryboardDocumentSchema.parse(raw);
  if (base.scenes?.length) {
    return { ...base, schemaVersion: 2 as const, scenes: base.scenes };
  }
  const frames = base.frames ?? [];
  const scenes = frames.map((f) =>
    ProductionStoryboardSceneSchema.parse({
      sceneId: f.sceneId,
      order: f.sequence,
      title: f.visualDescription.slice(0, 120) || `Scene ${f.sequence}`,
      description: f.visualDescription,
      durationSeconds: f.durationSeconds,
      visualDescription: f.visualDescription,
      firstFramePrompt: f.firstFramePrompt,
      videoMotionPrompt: f.videoMotionPrompt,
      narration: f.narration,
      revision: 1,
      status: "draft",
    }),
  );
  return { ...base, schemaVersion: 2 as const, scenes };
}

export const AgentProductionStateSchema = z.enum([
  "DRAFT",
  "BRIEFING",
  "PLANNING",
  "WAITING_PLAN_APPROVAL",
  "SCRIPTING",
  "WAITING_SCRIPT_APPROVAL",
  "STORYBOARDING",
  "WAITING_STORYBOARD_APPROVAL",
  "READY_FOR_PRODUCTION",
  "WAITING_COST_APPROVAL",
  "WAITING_PRODUCTION_APPROVAL",
  "QUEUED",
  "PRODUCING",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "PAUSED",
  "FAILED",
  "CANCELLED",
  "NEEDS_REVISION",
  "BLOCKED_PROVIDER",
  "BLOCKED_BUDGET",
]);

export const CreateAgentRunBodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  userRequest: z.string().min(1).max(50_000),
  idempotencyKey: z.string().max(128).optional(),
});

export const AgentRunResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  conversationId: z.string().uuid().nullable(),
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  productionState: AgentProductionStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductionBrief = z.infer<typeof ProductionBriefSchema>;
export type ProductionPlan = z.infer<typeof ProductionPlanSchema>;
export type ScriptDocument = z.infer<typeof ScriptDocumentSchema>;
export type StoryboardScene = z.infer<typeof ProductionStoryboardSceneSchema>;
export type StoryboardDocument = z.infer<typeof ProductionStoryboardDocumentSchema>;
export type ReferenceRole = z.infer<typeof ReferenceRoleSchema>;
export type ReferenceLink = z.infer<typeof ReferenceLinkSchema>;
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;
export type AgentProductionState = z.infer<typeof AgentProductionStateSchema>;
