import { z } from "zod";
import type { AppEnv } from "@shotbro/config/env";
import type {
  MediaProviderAdapter,
  NormalizedProviderError,
  ProviderCostEstimate,
  ProviderSubmitResult,
} from "./provider-contracts.js";
import { VideoOperationSchema } from "./provider-contracts.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { FalQueueClient } from "./fal-queue-client.js";

const videoInput = z.object({
  prompt: z.string().min(1),
});

/** Fal queue adapter for minimax/h3/text-to-video (official model API). */
export class FalMinimaxH3VideoAdapter implements MediaProviderAdapter {
  readonly providerId = "fal-minimax-video";
  readonly modality = "video" as const;
  static readonly modelId = "minimax/h3/text-to-video";
  static readonly submitPath = "minimax/h3/text-to-video";

  private readonly fal: FalQueueClient;

  constructor(
    private readonly env: AppEnv,
    http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.fal = new FalQueueClient(env, http);
  }

  getCapabilities(modelId: string) {
    if (modelId !== FalMinimaxH3VideoAdapter.modelId) {
      throw new Error(`Unsupported model: ${modelId}`);
    }
    return {
      operations: [VideoOperationSchema.enum.TEXT_TO_VIDEO],
      async: true,
      supportsCancel: true,
      maxDurationSeconds: 1200,
    };
  }

  validateRequest(modelId: string, operation: string, input: unknown) {
    VideoOperationSchema.parse(operation);
    if (modelId !== FalMinimaxH3VideoAdapter.modelId) throw new Error(`Unsupported model: ${modelId}`);
    if (operation !== "TEXT_TO_VIDEO") throw new Error(`Unsupported operation: ${operation}`);
    videoInput.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return { amountUsd: 0, priceStatus: "UNKNOWN", currency: "USD", billingUnit: "video" };
  }

  async submit(
    modelId: string,
    operation: string,
    input: unknown,
    _ctx: { idempotencyKey: string },
  ): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    const parsed = videoInput.parse(input);
    try {
      const queued = await this.fal.submit(FalMinimaxH3VideoAdapter.submitPath, { prompt: parsed.prompt });
      return {
        status: "SUBMITTED",
        providerJobId: queued.request_id,
        usage: { falStatusUrl: queued.status_url, falResponseUrl: queued.response_url },
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  parseResult(payload: unknown): ProviderSubmitResult {
    const data = payload as { video?: { url: string } };
    const url = data.video?.url;
    if (!url) return { status: "SUBMITTED" };
    return {
      status: "COMPLETED",
      outputs: [{ url, mimeType: "video/mp4" }],
    };
  }

  mapError(err: unknown): NormalizedProviderError {
    return this.fal.mapError(err);
  }
}
