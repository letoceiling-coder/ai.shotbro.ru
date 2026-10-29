import { z } from "zod";

export type ProviderCapabilities = {
  operations: string[];
  async: boolean;
  supportsCancel: boolean;
  supportsStreaming?: boolean;
  maxDurationSeconds?: number;
};

export type ProviderCostEstimate = {
  amountUsd: number;
  priceStatus: "KNOWN" | "UNKNOWN";
  currency: string;
  billingUnit: string;
};

export type NormalizedProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  httpStatus?: number;
};

export type ProviderSubmitResult = {
  providerJobId?: string;
  status: "SUBMITTED" | "COMPLETED";
  outputs?: Array<{
    url?: string;
    assetId?: string;
    mimeType?: string;
    mock?: boolean;
    /** Provider-side id of the produced entity (voice_id, generated_voice_id, look id). */
    externalId?: string;
    /** Inline media (e.g. ElevenLabs Voice Design previews); ingested into MinIO, never exposed. */
    base64?: string;
    durationSecs?: number;
    label?: string;
  }>;
  usage?: Record<string, unknown>;
};

export interface MediaProviderAdapter {
  readonly providerId: string;
  readonly modality: "image" | "video" | "audio" | "llm";
  getCapabilities(modelId: string): ProviderCapabilities;
  validateRequest(modelId: string, operation: string, input: unknown): void;
  estimateCost(modelId: string, operation: string, input: unknown): ProviderCostEstimate;
  submit(modelId: string, operation: string, input: unknown, ctx: { idempotencyKey: string }): Promise<ProviderSubmitResult>;
  getStatus?(providerJobId: string): Promise<{ status: string; progress?: number }>;
  cancel?(providerJobId: string): Promise<{ cancelled: boolean; reason?: string }>;
  parseResult?(payload: unknown): ProviderSubmitResult;
  mapError(err: unknown): NormalizedProviderError;
}

export const ImageOperationSchema = z.enum([
  "TEXT_TO_IMAGE",
  "IMAGE_TO_IMAGE",
  "IMAGE_EDIT",
  "REFERENCE_GUIDED_IMAGE",
  "IMAGE_VARIATION",
  "IMAGE_UPSCALE",
]);

export const VideoOperationSchema = z.enum([
  "TEXT_TO_VIDEO",
  "IMAGE_TO_VIDEO",
  "START_END_FRAME_VIDEO",
  "REFERENCE_VIDEO",
  "VIDEO_EXTENSION",
  "VIDEO_EDIT",
]);

export const AudioOperationSchema = z.enum(["TEXT_TO_SPEECH"]);

/** Phase 6: ElevenLabs voice creation (IVC clone, Voice Design previews, save designed voice). */
export const VoiceOperationSchema = z.enum(["VOICE_CLONE", "VOICE_DESIGN", "VOICE_SAVE"]);

/** Phase 6: HeyGen photo avatar training and avatar (talking photo) video. */
export const AvatarOperationSchema = z.enum(["AVATAR_TRAIN", "AVATAR_VIDEO"]);
