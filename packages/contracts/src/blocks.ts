import { z } from "zod";
import { GenerationStatusSchema, PlanStepStatusSchema } from "./status";

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  url: z.string(),
  sizeLabel: z.string().optional(),
  kind: z.enum(["image", "video", "audio", "document"]),
  demo: z.literal(true).optional(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

export const TextBlockSchema = z.object({
  type: z.literal("text"),
  markdown: z.string(),
});

export const GenerationPlanStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: PlanStepStatusSchema,
  detail: z.string().optional(),
});

export const GenerationPlanBlockSchema = z.object({
  type: z.literal("generation_plan"),
  title: z.string().default("План генерации"),
  demo: z.literal(true),
  overallStatus: GenerationStatusSchema,
  steps: z.array(GenerationPlanStepSchema),
});

export const ScriptSceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  timeRange: z.string(),
  description: z.string(),
});

export const ScriptBlockSchema = z.object({
  type: z.literal("script"),
  title: z.string(),
  demo: z.literal(true),
  durationLabel: z.string(),
  scenes: z.array(ScriptSceneSchema),
});

export const ApprovalActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(["primary", "secondary", "ghost"]).default("secondary"),
});

export const ApprovalBlockSchema = z.object({
  type: z.literal("approval"),
  demo: z.literal(true).optional(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "revision"]),
  approvalId: z.string(),
  expectedVersion: z.string().optional(),
  payloadHash: z.string().optional(),
  actions: z.array(ApprovalActionSchema),
  tags: z.array(z.string()).optional(),
});

export const CostLineSchema = z.object({
  label: z.string(),
  amountLabel: z.string(),
  note: z.string().optional(),
});

export const CostEstimateBlockSchema = z.object({
  type: z.literal("cost_estimate"),
  demo: z.literal(true),
  title: z.string().default("Оценка стоимости (DEMO)"),
  disclaimer: z.string(),
  totalLabel: z.string(),
  lines: z.array(CostLineSchema),
});

export const ModelOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  quality: z.string(),
  speed: z.string(),
  costLabel: z.string(),
  recommended: z.boolean().optional(),
});

export const ModelComparisonBlockSchema = z.object({
  type: z.literal("model_comparison"),
  demo: z.literal(true),
  title: z.string(),
  models: z.array(ModelOptionSchema),
  selectedId: z.string().optional(),
});

export const ImageResultBlockSchema = z.object({
  type: z.literal("image_result"),
  demo: z.literal(true),
  title: z.string(),
  url: z.string(),
  format: z.string(),
  version: z.number(),
  params: z.record(z.string(), z.string()).optional(),
});

export const VideoResultBlockSchema = z.object({
  type: z.literal("video_result"),
  demo: z.literal(true),
  title: z.string(),
  assetId: z.string().uuid().optional(),
  url: z.string(),
  posterUrl: z.string().optional(),
  durationLabel: z.string(),
  aspectRatio: z.string(),
  resolution: z.string(),
  version: z.number(),
});

export const AudioResultBlockSchema = z.object({
  type: z.literal("audio_result"),
  demo: z.literal(true),
  title: z.string(),
  url: z.string(),
  durationLabel: z.string(),
  voiceLabel: z.string(),
  version: z.number(),
});

export const StoryboardSceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  thumbnailUrl: z.string(),
  status: PlanStepStatusSchema,
  durationLabel: z.string().optional(),
});

export const StoryboardBlockSchema = z.object({
  type: z.literal("storyboard"),
  demo: z.literal(true),
  title: z.string(),
  scenes: z.array(StoryboardSceneSchema),
});

export const ToolExecutionBlockSchema = z.object({
  type: z.literal("tool_execution"),
  demo: z.literal(true),
  toolId: z.string(),
  toolName: z.string(),
  status: GenerationStatusSchema,
  message: z.string(),
  simulationLabel: z.string().optional(),
});

export const ErrorBlockSchema = z.object({
  type: z.literal("error"),
  demo: z.literal(true),
  operation: z.string(),
  reason: z.string(),
  retryActionId: z.string().optional(),
  reviseActionId: z.string().optional(),
});

export const AgentActivityBlockSchema = z.object({
  type: z.literal("agent_activity"),
  demo: z.literal(true),
  label: z.string(),
  status: GenerationStatusSchema,
  simulationLabel: z.string().default("Симуляция процесса"),
  runId: z.string().optional(),
  traceId: z.string().optional(),
  activeTools: z.array(z.string()).optional(),
  goal: z.string().optional(),
});

export const VersionHistoryItemSchema = z.object({
  id: z.string(),
  version: z.number(),
  label: z.string(),
  createdAtLabel: z.string(),
  previewUrl: z.string().optional(),
});

export const VersionHistoryBlockSchema = z.object({
  type: z.literal("version_history"),
  demo: z.literal(true),
  title: z.string(),
  items: z.array(VersionHistoryItemSchema),
  activeVersionId: z.string(),
});

export const ProductionBoardStageSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: GenerationStatusSchema,
});

export const ProductionBoardBlockSchema = z.object({
  type: z.literal("production_board"),
  demo: z.literal(true),
  title: z.string(),
  runId: z.string().uuid(),
  stages: z.array(ProductionBoardStageSchema),
});

export const ProviderStatusBlockSchema = z.object({
  type: z.literal("provider_status"),
  demo: z.literal(true),
  providerJobId: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  operation: z.string(),
  status: z.string(),
  graphNodeId: z.string().optional(),
  mockLabel: z.string().default("MOCK · provider job"),
});

export const ProductionProgressBlockSchema = z.object({
  type: z.literal("production_progress"),
  demo: z.literal(true),
  runId: z.string(),
  traceId: z.string().optional(),
  stage: z.string(),
  percent: z.number().min(0).max(100),
  message: z.string().optional(),
});

export const DeliveryBlockSchema = z.object({
  type: z.literal("delivery"),
  demo: z.literal(true),
  runId: z.string(),
  assetId: z.string().optional(),
  url: z.string().optional(),
  format: z.string().default("mp4"),
  mockLabel: z.string().default("MOCK RESULT"),
});

/** Phase 5K: REAL tool outcome from mock creative agent (data from API/DB). */
export const AgentToolResultBlockSchema = z.object({
  type: z.literal("agent_tool_result"),
  mockAgent: z.boolean().optional(),
  toolName: z.string(),
  success: z.boolean(),
  humanReadableSummary: z.string(),
  projectId: z.string(),
  assetId: z.string().optional(),
  sceneId: z.string().optional(),
  revision: z.number().optional(),
  errorCode: z.string().optional(),
  deepLink: z
    .object({
      creativeSection: z.enum([
        "chat",
        "storyboard",
        "assets",
        "timeline",
        "prompts",
        "references",
        "characters",
        "models",
        "voices",
        "avatars",
        "canvas",
      ]),
      sceneId: z.string().optional(),
      assetId: z.string().optional(),
      clipId: z.string().optional(),
    })
    .optional(),
});

export const MessageBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  GenerationPlanBlockSchema,
  ScriptBlockSchema,
  ApprovalBlockSchema,
  CostEstimateBlockSchema,
  ModelComparisonBlockSchema,
  ImageResultBlockSchema,
  VideoResultBlockSchema,
  AudioResultBlockSchema,
  StoryboardBlockSchema,
  ToolExecutionBlockSchema,
  ErrorBlockSchema,
  AgentActivityBlockSchema,
  VersionHistoryBlockSchema,
  ProductionBoardBlockSchema,
  ProviderStatusBlockSchema,
  ProductionProgressBlockSchema,
  DeliveryBlockSchema,
  AgentToolResultBlockSchema,
]);

export type MessageBlock = z.infer<typeof MessageBlockSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  createdAt: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
  blocks: z.array(MessageBlockSchema),
  demo: z.literal(true).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
