import { z } from "zod";

export const SceneImagePromptSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  visualStyle: z.string().optional(),
  composition: z.string().optional(),
  lighting: z.string().optional(),
  cameraAngle: z.string().optional(),
  characterRefNotes: z.string().optional(),
  productRefNotes: z.string().optional(),
  firstFrameRequirements: z.string().optional(),
});

export const SceneVideoPromptSchema = z.object({
  sceneAction: z.string().optional(),
  cameraMovement: z.string().optional(),
  characterMovement: z.string().optional(),
  dialogue: z.string().optional(),
  environment: z.string().optional(),
  lighting: z.string().optional(),
  motionInstructions: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  aspectRatio: z.string().optional(),
});

export const ScenePromptBundleSchema = z.object({
  image: SceneImagePromptSchema,
  video: SceneVideoPromptSchema,
  imageModelId: z.string().default("mock/image"),
  videoModelId: z.string().default("mock/video"),
  modelParameters: z.record(z.string(), z.record(z.unknown())).optional(),
  restoredFromVersion: z.number().int().positive().optional(),
});

export type SceneImagePrompt = z.infer<typeof SceneImagePromptSchema>;
export type SceneVideoPrompt = z.infer<typeof SceneVideoPromptSchema>;
export type ScenePromptBundle = z.infer<typeof ScenePromptBundleSchema>;

export const SaveScenePromptBodySchema = z.object({
  bundle: ScenePromptBundleSchema,
  changeNote: z.string().optional(),
});
