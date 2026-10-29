import { z } from "zod";
import type { AppEnv } from "@shotbro/config/env";
import { getHeyGenConfig } from "@shotbro/config/vendor-providers";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type {
  MediaProviderAdapter,
  NormalizedProviderError,
  ProviderCostEstimate,
  ProviderSubmitResult,
} from "./provider-contracts.js";
import { AvatarOperationSchema } from "./provider-contracts.js";
import type { HttpResponse, HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { mapTransportError, normalizeHttpProviderError } from "./provider-http-errors.js";

/**
 * HeyGen photo avatars (API v2). Field names follow docs.heygen.com as of 2026-10-30 and must be
 * re-verified against the API reference before the first live run (Phase 6G).
 *
 * providerJobId is prefixed so getStatus knows what to poll: `train:<group_id>` / `video:<video_id>`.
 */
const UPLOAD_URL = "https://upload.heygen.com/v1/asset";

export const HeyGenTrainInputSchema = z.object({
  name: z.string().min(1).max(120),
  /** image_key values returned by uploadPhoto(); first one creates the group. */
  imageKeys: z.array(z.string().min(1)).min(1).max(10),
});

export const HeyGenAvatarVideoInputSchema = z
  .object({
    talkingPhotoId: z.string().min(1),
    /** Either text spoken with a HeyGen voice id … */
    text: z.string().min(1).max(5000).optional(),
    heygenVoiceId: z.string().min(1).optional(),
    /** … or our own ElevenLabs voiceover (signed URL of the MinIO asset). */
    audioUrl: z.string().url().optional(),
    width: z.number().int().min(256).max(1920).default(720),
    height: z.number().int().min(256).max(1920).default(1280),
    /** Budget guard: requested length; enforced again by the job runner. */
    maxDurationSeconds: z.number().int().min(1).max(60).default(10),
  })
  .refine((v) => Boolean(v.audioUrl) || Boolean(v.text && v.heygenVoiceId), {
    message: "Нужна готовая озвучка (audioUrl) или текст + голос HeyGen",
  });

type HeyGenEnvelope<T> = { error?: unknown; data?: T };

function data<T>(res: HttpResponse): T {
  return ((res.body as HeyGenEnvelope<T>)?.data ?? {}) as T;
}

export class HeyGenAvatarAdapter implements MediaProviderAdapter {
  readonly providerId = "heygen";
  readonly modality = "video" as const;
  private readonly policy: ExecutionPolicyEngine;

  constructor(
    private readonly env: AppEnv,
    private readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { "X-Api-Key": getHeyGenConfig(this.env).hasApiKey ? this.env.HEYGEN_API_KEY! : "" };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  private base() {
    return getHeyGenConfig(this.env).baseUrl;
  }

  private async call(req: Parameters<HttpTransport["request"]>[0]) {
    this.policy.assertProviderNetworkCall();
    const res = await this.http.request(req);
    if (res.status >= 400) throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: this.providerId });
    return res;
  }

  getCapabilities(_modelId: string) {
    return {
      operations: [...AvatarOperationSchema.options],
      async: true,
      supportsCancel: false,
      maxDurationSeconds: 60,
    };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    const op = AvatarOperationSchema.parse(operation);
    if (op === "AVATAR_TRAIN") HeyGenTrainInputSchema.parse(input);
    else HeyGenAvatarVideoInputSchema.parse(input);
  }

  /** Price is not exposed by the HeyGen API; Phase 6C price catalog supplies the user-facing estimate. */
  estimateCost(modelId: string, operation: string, input: unknown): ProviderCostEstimate {
    this.validateRequest(modelId, operation, input);
    return {
      amountUsd: 0,
      priceStatus: "UNKNOWN",
      currency: "USD",
      billingUnit: operation === "AVATAR_TRAIN" ? "avatar" : "second",
    };
  }

  /** Raw image upload → image_key used by avatar group calls. */
  async uploadPhoto(photo: Buffer, contentType: string): Promise<string> {
    try {
      const res = await this.call({
        method: "POST",
        url: UPLOAD_URL,
        headers: { ...this.headers(false), "Content-Type": contentType },
        rawBody: photo,
        timeoutMs: 60_000,
      });
      const d = data<{ image_key?: string; id?: string }>(res);
      const key = d.image_key ?? d.id;
      if (!key) throw { code: "PROVIDER_BAD_RESPONSE", message: "HeyGen upload: нет image_key", retryable: false };
      return key;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async submit(modelId: string, operation: string, input: unknown, _ctx: { idempotencyKey: string }): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    try {
      if (operation === "AVATAR_TRAIN") return await this.train(HeyGenTrainInputSchema.parse(input));
      return await this.generateVideo(HeyGenAvatarVideoInputSchema.parse(input));
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private async train(input: z.infer<typeof HeyGenTrainInputSchema>): Promise<ProviderSubmitResult> {
    const [first, ...rest] = input.imageKeys;
    const created = await this.call({
      method: "POST",
      url: `${this.base()}/v2/photo_avatar/avatar_group/create`,
      headers: this.headers(),
      body: { name: input.name, image_key: first },
      timeoutMs: 60_000,
    });
    const groupId = data<{ group_id?: string; id?: string }>(created).group_id ?? data<{ id?: string }>(created).id;
    if (!groupId) throw { code: "PROVIDER_BAD_RESPONSE", message: "HeyGen: нет group_id", retryable: false };
    if (rest.length) {
      await this.call({
        method: "POST",
        url: `${this.base()}/v2/photo_avatar/avatar_group/add`,
        headers: this.headers(),
        body: { group_id: groupId, image_keys: rest, name: input.name },
        timeoutMs: 60_000,
      });
    }
    await this.call({
      method: "POST",
      url: `${this.base()}/v2/photo_avatar/train`,
      headers: this.headers(),
      body: { group_id: groupId },
      timeoutMs: 60_000,
    });
    return { status: "SUBMITTED", providerJobId: `train:${groupId}`, usage: { photos: input.imageKeys.length } };
  }

  private async generateVideo(input: z.infer<typeof HeyGenAvatarVideoInputSchema>): Promise<ProviderSubmitResult> {
    const voice = input.audioUrl
      ? { type: "audio", audio_url: input.audioUrl }
      : { type: "text", input_text: input.text, voice_id: input.heygenVoiceId };
    const res = await this.call({
      method: "POST",
      url: `${this.base()}/v2/video/generate`,
      headers: this.headers(),
      body: {
        video_inputs: [{ character: { type: "talking_photo", talking_photo_id: input.talkingPhotoId }, voice }],
        dimension: { width: input.width, height: input.height },
      },
      timeoutMs: 60_000,
    });
    const videoId = data<{ video_id?: string }>(res).video_id;
    if (!videoId) throw { code: "PROVIDER_BAD_RESPONSE", message: "HeyGen: нет video_id", retryable: false };
    return { status: "SUBMITTED", providerJobId: `video:${videoId}`, usage: { maxDurationSeconds: input.maxDurationSeconds } };
  }

  async getStatus(providerJobId: string): Promise<{ status: string; progress?: number; outputs?: ProviderSubmitResult["outputs"] }> {
    const [kind, id] = providerJobId.split(":", 2);
    if (!id) throw this.mapError({ code: "INVALID_REQUEST", message: "bad providerJobId", retryable: false });
    try {
      if (kind === "train") {
        const res = await this.call({
          method: "GET",
          url: `${this.base()}/v2/photo_avatar/train/status/${encodeURIComponent(id)}`,
          headers: this.headers(),
          timeoutMs: 30_000,
        });
        const status = String(data<{ status?: string }>(res).status ?? "pending").toLowerCase();
        if (status !== "ready") return { status: status === "failed" ? "FAILED" : "RUNNING" };
        return { status: "COMPLETED", outputs: await this.listLooks(id) };
      }
      const res = await this.call({
        method: "GET",
        url: `${this.base()}/v1/video_status.get?video_id=${encodeURIComponent(id)}`,
        headers: this.headers(),
        timeoutMs: 30_000,
      });
      const d = data<{ status?: string; video_url?: string; duration?: number }>(res);
      const status = String(d.status ?? "processing").toLowerCase();
      if (status === "completed" && d.video_url) {
        return { status: "COMPLETED", outputs: [{ url: d.video_url, mimeType: "video/mp4", durationSecs: d.duration }] };
      }
      return { status: status === "failed" ? "FAILED" : "RUNNING" };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Looks of a trained group; each look id is the talking_photo_id for video generation. */
  async listLooks(groupId: string): Promise<NonNullable<ProviderSubmitResult["outputs"]>> {
    const res = await this.call({
      method: "GET",
      url: `${this.base()}/v2/avatar_group/${encodeURIComponent(groupId)}/avatars`,
      headers: this.headers(),
      timeoutMs: 30_000,
    });
    const list = data<{ avatar_list?: Array<{ id: string; name?: string; image_url?: string }> }>(res).avatar_list ?? [];
    return list.map((a) => ({ externalId: a.id, label: a.name ?? a.id, url: a.image_url, mimeType: "image/jpeg" }));
  }

  mapError(err: unknown): NormalizedProviderError {
    if (typeof err === "object" && err !== null && "code" in err) return err as NormalizedProviderError;
    return mapTransportError(err, this.providerId);
  }
}
