import { z } from "zod";
import type { MediaProviderAdapter, ProviderCostEstimate, ProviderSubmitResult, NormalizedProviderError } from "./provider-contracts.js";
import { VideoOperationSchema } from "./provider-contracts.js";

const inputSchema = z.object({
  prompt: z.string().min(1),
  durationSeconds: z.number().positive().max(120).optional(),
  aspectRatio: z.string().optional(),
  firstFrameAssetId: z.string().optional(),
  lastFrameAssetId: z.string().optional(),
});

export class Phase4MockVideoProvider implements MediaProviderAdapter {
  readonly providerId = "mock-video";
  readonly modality = "video" as const;

  getCapabilities(_modelId: string) {
    return {
      operations: Object.values(VideoOperationSchema.enum),
      async: true,
      supportsCancel: true,
    };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    VideoOperationSchema.parse(operation);
    inputSchema.parse(input);
  }

  estimateCost(_modelId: string, _op: string, input: unknown): ProviderCostEstimate {
    const parsed = inputSchema.parse(input);
    const sec = parsed.durationSeconds ?? 5;
    return { amountUsd: sec * 0.05, priceStatus: "KNOWN", currency: "USD", billingUnit: "second" };
  }

  async submit(_modelId: string, operation: string, input: unknown): Promise<ProviderSubmitResult> {
    this.validateRequest(_modelId, operation, input);
    return {
      status: "SUBMITTED",
      providerJobId: `mock-vid-${Date.now()}`,
      usage: { mock: true },
    };
  }

  mapError(err: unknown): NormalizedProviderError {
    return { code: "MOCK_VIDEO_ERROR", message: err instanceof Error ? err.message : "error", retryable: true };
  }
}
