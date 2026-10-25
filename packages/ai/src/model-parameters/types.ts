import { z } from "zod";

export const ParameterFieldTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "enum",
  "array",
  "asset_reference",
  "model_reference",
]);

export type ParameterFieldType = z.infer<typeof ParameterFieldTypeSchema>;

export type ModelParameterField = {
  key: string;
  type: ParameterFieldType;
  label: string;
  description?: string;
  tooltip?: string;
  required?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  step?: number;
  enumValues?: string[];
  uiGroup?: "basic" | "advanced" | "expert";
  uiOrder?: number;
  dependsOn?: string;
  visibleWhen?: Record<string, unknown>;
};

export type ModelParameterDefinition = {
  providerId: string;
  modelId: string;
  operation: string;
  displayName: string;
  documentationUrl?: string;
  parameterSchema: ModelParameterField[];
  defaultParameters: Record<string, unknown>;
  presets: Array<{
    id: string;
    label: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
};

export const SceneModelSettingsSchema = z.object({
  sceneId: z.string(),
  imageModelId: z.string().optional(),
  videoModelId: z.string().optional(),
  voiceModelId: z.string().optional(),
  enhancementModelId: z.string().optional(),
  primaryProviderId: z.string().optional(),
  primaryModelId: z.string().optional(),
  fallbackProviderId: z.string().optional(),
  fallbackModelId: z.string().optional(),
  fallbackMode: z.enum(["disabled", "automatic_compatible", "ask_before_switch"]).optional(),
  strictVoiceConsistency: z.boolean().optional(),
  parameters: z.record(z.record(z.unknown())).default({}),
  presetId: z.string().optional(),
  version: z.number().int().positive().default(1),
});

export type SceneModelSettings = z.infer<typeof SceneModelSettingsSchema>;
