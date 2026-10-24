import { z } from "zod";
import type { AppEnv } from "@shotbro/config/env";
import type {
  MediaProviderAdapter,
  NormalizedProviderError,
  ProviderCostEstimate,
  ProviderSubmitResult,
} from "./provider-contracts.js";
import { ImageOperationSchema } from "./provider-contracts.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { FalQueueClient } from "./fal-queue-client.js";

const imageInput = z.object({
  prompt: z.string().min(1),
  image_size: z.string().optional(),
  num_inference_steps: z.number().int().optional(),
});

/** Fal queue adapter for fal-ai/flux/dev (official model API). */
export class FalFluxDevImageAdapter implements MediaProviderAdapter {
  readonly providerId = "fal-flux";
  readonly modality = "image" as const;
  static readonly modelId = "fal-ai/flux/dev";
  static readonly submitPath = "fal-ai/flux/dev";

  private readonly fal: FalQueueClient;

  constructor(
    private readonly env: AppEnv,
    http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.fal = new FalQueueClient(env, http);
  }

  getCapabilities(modelId: string) {
    if (modelId !== FalFluxDevImageAdapter.modelId) {
      throw new Error(`Unsupported model: ${modelId}`);
    }
    return {
      operations: [ImageOperationSchema.enum.TEXT_TO_IMAGE],
      async: true,
      supportsCancel: true,
      maxDurationSeconds: 600,
    };
  }

  validateRequest(modelId: string, operation: string, input: unknown) {
    ImageOperationSchema.parse(operation);
    if (modelId !== FalFluxDevImageAdapter.modelId) throw new Error(`Unsupported model: ${modelId}`);
    if (operation !== "TEXT_TO_IMAGE") throw new Error(`Unsupported operation: ${operation}`);
    imageInput.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return { amountUsd: 0, priceStatus: "UNKNOWN", currency: "USD", billingUnit: "image" };
  }

  async submit(
    modelId: string,
    operation: string,
    input: unknown,
    _ctx: { idempotencyKey: string },
  ): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    const parsed = imageInput.parse(input);
    try {
      const queued = await this.fal.submit(FalFluxDevImageAdapter.submitPath, {
        prompt: parsed.prompt,
        image_size: parsed.image_size,
        num_inference_steps: parsed.num_inference_steps,
      });
      return {
        status: "SUBMITTED",
        providerJobId: queued.request_id,
        usage: { falStatusUrl: queued.status_url, falResponseUrl: queued.response_url },
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async getStatus(providerJobId: string, statusUrl?: string) {
    if (!statusUrl) return { status: "UNKNOWN" };
    const st = await this.fal.getStatus(statusUrl);
    if (st.status === "IN_QUEUE") return { status: "QUEUED", progress: 0 };
    if (st.status === "IN_PROGRESS") return { status: "RUNNING", progress: 50 };
    return { status: "COMPLETED", progress: 100 };
  }

  parseResult(payload: unknown): ProviderSubmitResult {
    const data = payload as { images?: Array<{ url: string }>; response_url?: string };
    const url = data.images?.[0]?.url;
    if (!url) {
      return { status: "SUBMITTED", providerJobId: undefined };
    }
    return {
      status: "COMPLETED",
      outputs: [{ url, mimeType: "image/png" }],
    };
  }

  mapError(err: unknown): NormalizedProviderError {
    return this.fal.mapError(err);
  }
}
