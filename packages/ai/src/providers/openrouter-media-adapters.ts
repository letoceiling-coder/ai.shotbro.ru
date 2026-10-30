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

/** POST /api/v1/images (OpenRouter Image API, verified 2026-10-30). */
const imageInput = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  /** Image-to-image: URLs or base64 data URLs. */
  input_references: z.array(z.string().min(1)).max(4).optional(),
});

/** POST /api/v1/videos (OpenRouter Video API, verified 2026-10-30). */
const videoInput = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  duration: z.number().int().positive().max(15).optional(),
  resolution: z.string().optional(),
  aspect_ratio: z.string().optional(),
  /** First frame (image-to-video): public https URL → `frame_images`. */
  first_frame_url: z.string().url().optional(),
  /** Reference images (e.g. heygen/avatar-iv photo, which rejects frame_images) → `input_references`. */
  reference_urls: z.array(z.string().url()).max(4).optional(),
  generate_audio: z.boolean().optional(),
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

abstract class OpenRouterMediaAdapterBase {
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
    if (typeof err === "object" && err !== null && "code" in err) {
      return err as NormalizedProviderError;
    }
    if (typeof err === "object" && err !== null && "status" in err && typeof (err as { status: unknown }).status === "number") {
      const e = err as { status: number; body?: unknown };
      return normalizeHttpProviderError({ status: e.status, body: e.body, providerId: this.providerId });
    }
    return mapTransportError(err, this.providerId);
  }
}

/** POST /images — OpenRouter multimodal image generation (docs 2026-10-25). */
export class OpenRouterImageAdapter extends OpenRouterMediaAdapterBase implements MediaProviderAdapter {
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
      const { model, ...rest } = parsed;
      const res = await this.post("/images", { ...rest, model: model ?? modelId, n: 1 });
      if (res.status >= 400) throw Object.assign(new Error("openrouter_image_error"), { status: res.status, body: res.body });
      const body = res.body as {
        data?: Array<{ b64_json?: string; url?: string; media_type?: string }>;
        usage?: { cost?: number };
      };
      const first = body.data?.[0];
      if (!first?.b64_json && !first?.url) throw Object.assign(new Error("openrouter_image_empty"), { status: 502, body: res.body });
      return {
        status: "COMPLETED",
        outputs: [{ base64: first.b64_json, url: first.url, mimeType: first.media_type ?? "image/png" }],
        usage: { costUsd: body.usage?.cost ?? null },
      } satisfies ProviderSubmitResult;
    } catch (err) {
      throw this.mapError(err);
    }
  }
}

/** POST /videos + GET /videos/{jobId} — async video jobs. */
export class OpenRouterVideoAdapter extends OpenRouterMediaAdapterBase implements MediaProviderAdapter {
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
      const body: Record<string, unknown> = {
        model: parsed.model ?? modelId,
        prompt: parsed.prompt,
        ...(parsed.duration ? { duration: parsed.duration } : {}),
        ...(parsed.resolution ? { resolution: parsed.resolution } : {}),
        ...(parsed.aspect_ratio ? { aspect_ratio: parsed.aspect_ratio } : {}),
        ...(parsed.generate_audio != null ? { generate_audio: parsed.generate_audio } : {}),
        ...(parsed.first_frame_url
          ? { frame_images: [{ type: "image_url", image_url: { url: parsed.first_frame_url }, frame_type: "first_frame" }] }
          : {}),
        ...(parsed.reference_urls?.length
          ? { input_references: parsed.reference_urls.map((url) => ({ type: "image_url", image_url: { url } })) }
          : {}),
      };
      const res = await this.post("/videos", body);
      if (res.status >= 400) throw Object.assign(new Error("openrouter_video_error"), { status: res.status, body: res.body });
      const out = res.body as { id?: string; job_id?: string };
      const jobId = out.id ?? out.job_id;
      if (!jobId) throw Object.assign(new Error("openrouter_video_no_job"), { status: 502, body: res.body });
      return { status: "SUBMITTED", providerJobId: jobId } satisfies ProviderSubmitResult;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Normalised job state: pending | in_progress → RUNNING, completed → COMPLETED, failed/cancelled/expired → FAILED. */
  async getStatus(providerJobId: string) {
    const res = await this.get(`/videos/${encodeURIComponent(providerJobId)}`);
    if (res.status >= 400) throw this.mapError({ status: res.status, body: res.body });
    const body = res.body as { status?: string; error?: unknown; usage?: { cost?: number } };
    const raw = String(body.status ?? "unknown").toLowerCase();
    const status = raw === "completed" ? "COMPLETED" : ["failed", "cancelled", "expired"].includes(raw) ? "FAILED" : "RUNNING";
    return { status, rawStatus: raw, costUsd: body.usage?.cost ?? null, error: body.error ?? null };
  }

  /** GET /videos/{id}/content — the MP4 bytes (never exposes signed URLs). */
  async downloadContent(providerJobId: string, index = 0): Promise<Buffer> {
    this.policy.assertProviderNetworkCall();
    const cfg = getOpenRouterConfig(this.env);
    const res = await this.http.request({
      method: "GET",
      url: `${cfg.baseUrl}/videos/${encodeURIComponent(providerJobId)}/content?index=${index}`,
      headers: authHeaders(this.env, cfg),
      responseType: "binary",
      timeoutMs: 180_000,
    });
    if (res.status >= 400 || !Buffer.isBuffer(res.body)) throw this.mapError({ status: res.status || 502, body: res.body });
    return res.body;
  }
}

/** POST /audio/speech — TTS fallback. */
export class OpenRouterTtsAdapter extends OpenRouterMediaAdapterBase implements MediaProviderAdapter {
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
