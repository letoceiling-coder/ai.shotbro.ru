import { z } from "zod";
import type { MediaProviderAdapter, ProviderCostEstimate, ProviderSubmitResult, NormalizedProviderError } from "./provider-contracts.js";
import { AudioOperationSchema } from "./provider-contracts.js";

const ttsInput = z.object({
  text: z.string().min(1),
  voiceId: z.string().min(1),
  modelId: z.string().optional(),
  outputFormat: z.enum(["mp3", "wav", "pcm"]).optional(),
});

export class Phase4MockElevenLabsProvider implements MediaProviderAdapter {
  readonly providerId = "mock-elevenlabs";
  readonly modality = "audio" as const;

  getCapabilities(_modelId: string) {
    return { operations: Object.values(AudioOperationSchema.enum), async: false, supportsCancel: false };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    AudioOperationSchema.parse(operation);
    ttsInput.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return { amountUsd: 0, priceStatus: "UNKNOWN", currency: "USD", billingUnit: "character" };
  }

  async submit(_modelId: string, operation: string, input: unknown): Promise<ProviderSubmitResult> {
    this.validateRequest(_modelId, operation, input);
    return {
      status: "COMPLETED",
      providerJobId: `mock-tts-${Date.now()}`,
      outputs: [{ mock: true, mimeType: "audio/mpeg" }],
      usage: { mock: true, characters: ttsInput.parse(input).text.length },
    };
  }

  mapError(err: unknown): NormalizedProviderError {
    return { code: "MOCK_TTS_ERROR", message: err instanceof Error ? err.message : "error", retryable: false };
  }
}
