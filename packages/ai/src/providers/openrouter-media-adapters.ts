import { z } from "zod";
import type { AppEnv } from "@shotbro/config/env";
import { getOpenRouterConfig } from "@shotbro/config/openrouter";
import type {
  MediaProviderAdapter,
  NormalizedProviderError,
  ProviderCostEstimate,
  ProviderSubmitResult,
} from "./provider-contracts.js";
import { AudioOperationSchema, ImageOperationSchema, VideoOperationSchema } from "./provider-contracts.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import { mapTransportError, normalizeHttpProviderError } from "./provider-http-errors.js";

const imageInput = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  aspect_ratio: z.string().optional(),
  image_url: z.string().url().optional(),
});

const videoInput = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  duration_seconds: z.number().positive().optional(),
  aspect_ratio: z.string().optional(),
  image_url: z.string().url().optional(),
});

const ttsInput = z.object({
  input: z.string().min(1),
  model: z.string().optional(),
  voice: z.string().optional(),
  response_format: z.string().optional(),
});

function authHeaders(env: AppEnv, cfg: ReturnType<typeof getOpenRouterConfig>) {
  return {
    Authorization: cfg.hasApiKey && env.OPENROUTER_API_KEY ? `Bearer ${env.OPENROUTER_API_KEY}` : "",
    "Content-Type": "application/json",
  };
}

abstract class OpenRouterMediaAdapterBase implements MediaProviderAdapter {
  readonly providerId = "openrouter";
  protected readonly policy: ExecutionPolicyEngine;

  constructor(
    protected readonly env: AppEnv,
    protected readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  abstract readonly modality: "image" | "video" | "audio";
  abstract readonly defaultModelId: string;

  estimateCost(): ProviderCostEstimate {
    return { amountUsd: 0, priceStatus: "UNKNOWN", currency: "USD", billingUnit: "request" };
  }

  protected async post(path: string, body: unknown) {
    this.policy.assertProviderNetworkCall();
    const cfg = getOpenRouterConfig(this.env);
    const url = `${cfg.baseUrl}${path}`;
    return this.http.request({ method: "POST", url, headers: authHeaders(this.env, cfg), body, timeoutMs: 120_000 });
  }

  protected async get(path: string) {
    this.policy.assertProviderNetworkCall();
    const cfg = getOpenRouterConfig(this.env);
    return this.http.request({ method: "GET", url: `${cfg.baseUrl}${path}`, headers: authHeaders(this.env, cfg) });
  }

  mapError(err: unknown): NormalizedProviderError {
    return mapTransportError(err) ?? normalizeHttpProviderError(err);
  }
}

/** POST /images — OpenRouter multimodal image generation (docs 2026-10-25). */
export class OpenRouterImageAdapter extends OpenRouterMediaAdapterBase {
  readonly modality = "image" as const;
  readonly defaultModelId = "openrouter/image/auto";

  getCapabilities(modelId: string) {
    return {
      operations: [
        ImageOperationSchema.enum.TEXT_TO_IMAGE,
        ImageOperationSchema.enum.IMAGE_TO_IMAGE,
      ],
      async: false,
      supportsCancel: false,
    };
  }

  validateRequest(modelId: string, operation: string, input: unknown) {
    ImageOperationSchema.parse(operation);
    imageInput.parse(input);
  }

  async submit(modelId: string, operation: string, input: unknown, _ctx: { idempotencyKey: string }) {
    this.validateRequest(modelId, operation, input);
    const parsed = imageInput.parse(input);
    try {
      const res = await this.post("/images", { ...parsed, model: parsed.model ?? modelId });
      if (res.status >= 400) throw Object.assign(new Error("openrouter_image_error"), { status: res.status });
      const body = res.body as { data?: Array<{ url?: string }> };
      const url = body.data?.[0]?.url;
      return {
        status: url ? "COMPLETED" : "SUBMITTED",
        outputs: url ? [{ url, mimeType: "image/png" }] : undefined,
      } satisfies ProviderSubmitResult;
    } catch (err) {
      throw this.mapError(err);
    }
  }
}

/** POST /videos + GET /videos/{jobId} — async video jobs. */
export class OpenRouterVideoAdapter extends OpenRouterMediaAdapterBase {
  readonly modality = "video" as const;
  readonly defaultModelId = "openrouter/video/auto";

  getCapabilities(modelId: string) {
    return {
      operations: [
        VideoOperationSchema.enum.TEXT_TO_VIDEO,
        VideoOperationSchema.enum.IMAGE_TO_VIDEO,
      ],
      async: true,
      supportsCancel: false,
      maxDurationSeconds: 120,
    };
  }

  validateRequest(modelId: string, operation: string, input: unknown) {
    VideoOperationSchema.parse(operation);
    videoInput.parse(input);
  }

  async submit(modelId: string, operation: string, input: unknown, _ctx: { idempotencyKey: string }) {
    this.validateRequest(modelId, operation, input);
    const parsed = videoInput.parse(input);
    try {
      const res = await this.post("/videos", { ...parsed, model: parsed.model ?? modelId });
      if (res.status >= 400) throw Object.assign(new Error("openrouter_video_error"), { status: res.status });
      const body = res.body as { id?: string; job_id?: string };
      const jobId = body.id ?? body.job_id;
      return { status: "SUBMITTED", providerJobId: jobId } satisfies ProviderSubmitResult;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async getStatus(providerJobId: string) {
    const res = await this.get(`/videos/${encodeURIComponent(providerJobId)}`);
    const body = res.body as { status?: string };
    return { status: body.status ?? "UNKNOWN" };
  }
}

/** POST /audio/speech — TTS fallback. */
export class OpenRouterTtsAdapter extends OpenRouterMediaAdapterBase {
  readonly modality = "audio" as const;
  readonly defaultModelId = "openrouter/tts/auto";

  getCapabilities(_modelId: string) {
    return {
      operations: [AudioOperationSchema.enum.TEXT_TO_SPEECH],
      async: false,
      supportsCancel: false,
    };
  }

  validateRequest(modelId: string, operation: string, input: unknown) {
    AudioOperationSchema.parse(operation);
    ttsInput.parse(input);
  }

  async submit(modelId: string, operation: string, input: unknown, _ctx: { idempotencyKey: string }) {
    this.validateRequest(modelId, operation, input);
    const parsed = ttsInput.parse(input);
    try {
      const res = await this.post("/audio/speech", { ...parsed, model: parsed.model ?? modelId });
      if (res.status >= 400) throw Object.assign(new Error("openrouter_tts_error"), { status: res.status });
      return { status: "COMPLETED", usage: { note: "binary_audio_response" } } satisfies ProviderSubmitResult;
    } catch (err) {
      throw this.mapError(err);
    }
  }
}
