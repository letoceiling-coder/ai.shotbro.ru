import { z } from "zod";
import type { MediaProviderAdapter, ProviderCostEstimate, ProviderSubmitResult, NormalizedProviderError } from "./provider-contracts.js";
import { ImageOperationSchema } from "./provider-contracts.js";

const inputSchema = z.object({
  prompt: z.string().min(1),
  aspectRatio: z.string().optional(),
  referenceAssetId: z.string().optional(),
});

export class Phase4MockImageProvider implements MediaProviderAdapter {
  readonly providerId = "mock-image";
  readonly modality = "image" as const;

  getCapabilities(_modelId: string) {
    return {
      operations: Object.values(ImageOperationSchema.enum),
      async: false,
      supportsCancel: false,
    };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    ImageOperationSchema.parse(operation);
    inputSchema.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return { amountUsd: 0.05, priceStatus: "KNOWN", currency: "USD", billingUnit: "image" };
  }

  async submit(_modelId: string, operation: string, input: unknown): Promise<ProviderSubmitResult> {
    this.validateRequest(_modelId, operation, input);
    return {
      status: "COMPLETED",
      providerJobId: `mock-img-${Date.now()}`,
      outputs: [{ mock: true, mimeType: "image/png" }],
      usage: { mock: true },
    };
  }

  mapError(err: unknown): NormalizedProviderError {
    return { code: "MOCK_IMAGE_ERROR", message: err instanceof Error ? err.message : "error", retryable: false };
  }
}
