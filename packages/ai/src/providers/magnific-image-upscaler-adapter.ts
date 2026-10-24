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

/** Verified against https://docs.magnific.com/api-reference/image-upscaler-creative/post-image-upscaler (2026-10-25). */
export const MagnificOptimizedForSchema = z.enum([
  "standard",
  "soft_portraits",
  "hard_portraits",
  "art_n_illustration",
  "videogame_assets",
  "nature_n_landscapes",
  "films_n_photography",
  "3d_renders",
  "science_fiction_n_horror",
]);

export const MagnificEngineSchema = z.enum([
  "automatic",
  "magnific_illusio",
  "magnific_sharpy",
  "magnific_sparkle",
]);

export const MagnificUpscaleRequestSchema = z.object({
  image: z.string().min(1),
  webhook_url: z.string().url().optional(),
  scale_factor: z.enum(["2x", "4x", "8x", "16x"]).optional(),
  optimized_for: MagnificOptimizedForSchema.optional(),
  prompt: z.string().max(4000).optional(),
  creativity: z.number().int().min(-10).max(10).optional(),
  hdr: z.number().int().min(-10).max(10).optional(),
  resemblance: z.number().int().min(-10).max(10).optional(),
  fractality: z.number().int().min(-10).max(10).optional(),
  engine: MagnificEngineSchema.optional(),
  filter_nsfw: z.boolean().optional(),
});

export const MagnificSubmitResponseSchema = z.object({
  data: z.object({
    task_id: z.string(),
    status: z.string(),
    generated: z.array(z.unknown()).optional(),
  }),
});

const BASE = "https://api.magnific.com";

/** Typed adapter for Magnific Creative Image Upscaler (async task API). */
export class MagnificImageUpscalerAdapter implements MediaProviderAdapter {
  readonly providerId = "magnific";
  readonly modality = "image" as const;
  static readonly modelId = "magnific/image-upscaler-creative";

  constructor(
    private readonly env: AppEnv,
    private readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {}

  getCapabilities(modelId: string) {
    if (modelId !== MagnificImageUpscalerAdapter.modelId) {
      throw new Error(`Unsupported model: ${modelId}`);
    }
    return {
      operations: [ImageOperationSchema.enum.IMAGE_UPSCALE],
      async: true,
      supportsCancel: false,
      maxDurationSeconds: 900,
    };
  }

  validateRequest(modelId: string, operation: string, input: unknown) {
    ImageOperationSchema.parse(operation);
    if (modelId !== MagnificImageUpscalerAdapter.modelId) throw new Error(`Unsupported model: ${modelId}`);
    if (operation !== "IMAGE_UPSCALE") throw new Error(`Unsupported operation: ${operation}`);
    MagnificUpscaleRequestSchema.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return {
      amountUsd: 0,
      priceStatus: "UNKNOWN",
      currency: "EUR",
      billingUnit: "output_megapixels",
    };
  }

  async submit(
    modelId: string,
    operation: string,
    input: unknown,
    _ctx: { idempotencyKey: string },
  ): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    const body = MagnificUpscaleRequestSchema.parse(input);
    const apiKey = this.env.MAGNIFIC_API_KEY;
    if (!apiKey) {
      throw this.mapError(new Error("MAGNIFIC_API_KEY not configured"));
    }
    try {
      const res = await this.http.request({
        method: "POST",
        url: `${BASE}/v1/ai/image-upscaler`,
        headers: {
          "Content-Type": "application/json",
          "x-magnific-api-key": apiKey,
        },
        body,
        timeoutMs: 60_000,
      });
      if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
      if (res.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
      if (res.status >= 500) throw Object.assign(new Error("Server error"), { status: res.status });
      if (res.status >= 400) throw Object.assign(new Error("Bad request"), { status: res.status });
      const parsed = MagnificSubmitResponseSchema.parse(res.body);
      return {
        status: "SUBMITTED",
        providerJobId: parsed.data.task_id,
        usage: { magnificStatus: parsed.data.status },
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async getStatus(providerJobId: string) {
    const apiKey = this.env.MAGNIFIC_API_KEY;
    if (!apiKey) throw this.mapError(new Error("MAGNIFIC_API_KEY not configured"));
    const res = await this.http.request({
      method: "GET",
      url: `${BASE}/v1/ai/image-upscaler/${encodeURIComponent(providerJobId)}`,
      headers: { "x-magnific-api-key": apiKey },
      timeoutMs: 30_000,
    });
    const body = res.body as { data?: { status?: string } };
    return { status: body.data?.status ?? "UNKNOWN" };
  }

  mapError(err: unknown): NormalizedProviderError {
    const status = (err as { status?: number })?.status;
    if (status === 401) return { code: "auth_failed", message: "Magnific API key rejected", retryable: false, httpStatus: 401 };
    if (status === 429) return { code: "rate_limited", message: "Magnific rate limit", retryable: true, httpStatus: 429 };
    if (status && status >= 500) return { code: "provider_error", message: "Magnific server error", retryable: true, httpStatus: status };
    if (String(err).includes("blocked")) {
      return { code: "execution_blocked", message: "Live Magnific execution blocked by policy", retryable: false };
    }
    return { code: "magnific_error", message: err instanceof Error ? err.message : "Magnific error", retryable: false };
  }
}

/** Registry-facing facade for Magnific media capabilities. */
export class MagnificProviderAdapter {
  readonly upscaler: MagnificImageUpscalerAdapter;

  constructor(env: AppEnv, http?: HttpTransport) {
    this.upscaler = new MagnificImageUpscalerAdapter(env, http);
  }
}
