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

export const ScriptScenePayloadSchema = z.object({
  id: z.string(),
  sequence: z.number().int(),
  title: z.string(),
  durationSeconds: z.number().positive(),
  description: z.string(),
  narration: z.string().optional(),
});

export const ScriptDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  title: z.string(),
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

export const StoryboardDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  title: z.string(),
  frames: z.array(StoryboardFrameSchema).min(1),
  mock: z.literal(true).optional(),
});

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
export type StoryboardDocument = z.infer<typeof StoryboardDocumentSchema>;
export type AgentProductionState = z.infer<typeof AgentProductionStateSchema>;
