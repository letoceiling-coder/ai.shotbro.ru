import { z } from "zod";
import type { AppEnv } from "@shotbro/config/env";
import { getElevenLabsConfig } from "@shotbro/config/vendor-providers";
import type { LibraryVoice } from "@shotbro/contracts";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type {
  MediaProviderAdapter,
  NormalizedProviderError,
  ProviderCostEstimate,
  ProviderSubmitResult,
} from "./provider-contracts.js";
import { VoiceOperationSchema } from "./provider-contracts.js";
import type { HttpTransport, MultipartPart } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { mapTransportError, normalizeHttpProviderError } from "./provider-http-errors.js";

const BufferSchema = z.custom<Buffer>((v) => Buffer.isBuffer(v), "Ожидался файл (Buffer)");

/** IVC: POST /v1/voices/add (multipart). Samples are loaded from MinIO by the job runner. */
export const VoiceCloneInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  labels: z.record(z.string()).optional(),
  removeBackgroundNoise: z.boolean().optional(),
  files: z
    .array(z.object({ filename: z.string().min(1), contentType: z.string().min(1), data: BufferSchema }))
    .min(1)
    .max(5),
  /** Server sets this only when the consent record exists; adapter refuses otherwise. */
  consentVerified: z.literal(true),
});

/** Voice Design: POST /v1/text-to-voice/design → 3 previews. */
export const VoiceDesignInputSchema = z.object({
  voiceDescription: z.string().min(20).max(1000),
  text: z.string().min(100).max(1000).optional(),
  modelId: z.string().optional(),
});

/** Save chosen preview: POST /v1/text-to-voice. */
export const VoiceSaveInputSchema = z.object({
  voiceName: z.string().min(1).max(120),
  voiceDescription: z.string().min(20).max(1000),
  generatedVoiceId: z.string().min(1),
});

export class ElevenLabsVoiceAdapter implements MediaProviderAdapter {
  readonly providerId = "elevenlabs";
  readonly modality = "audio" as const;
  static readonly defaultDesignModelId = "eleven_multilingual_ttv_v2";
  private readonly policy: ExecutionPolicyEngine;

  constructor(
    private readonly env: AppEnv,
    private readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  private base() {
    return getElevenLabsConfig(this.env).baseUrl;
  }

  private key() {
    return getElevenLabsConfig(this.env).hasApiKey ? this.env.ELEVENLABS_API_KEY! : "";
  }

  private async call(req: Parameters<HttpTransport["request"]>[0]) {
    this.policy.assertProviderNetworkCall();
    const res = await this.http.request(req);
    if (res.status >= 400) throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: this.providerId });
    // Never treat a block page as data (an empty catalog hid a regional block in 6G).
    if (typeof res.body === "string" && res.body.trimStart().startsWith("<")) {
      throw normalizeHttpProviderError({ status: 502, body: "html_instead_of_api_response", providerId: this.providerId });
    }
    return res;
  }

  getCapabilities(_modelId: string) {
    return { operations: [...VoiceOperationSchema.options], async: false, supportsCancel: false };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    const op = VoiceOperationSchema.parse(operation);
    if (op === "VOICE_CLONE") VoiceCloneInputSchema.parse(input);
    else if (op === "VOICE_DESIGN") VoiceDesignInputSchema.parse(input);
    else VoiceSaveInputSchema.parse(input);
  }

  /** ElevenLabs bills by subscription credits; Phase 6C price catalog maps credits → USD. */
  estimateCost(modelId: string, operation: string, input: unknown): ProviderCostEstimate {
    this.validateRequest(modelId, operation, input);
    return { amountUsd: 0, priceStatus: "UNKNOWN", currency: "USD", billingUnit: operation === "VOICE_DESIGN" ? "preview" : "voice" };
  }

  /**
   * Read-only catalog browsing (GET /v2/voices + preview MP3s). Free, no side effects, no credits —
   * so it is allowed in test mode too (`ELEVENLABS_CATALOG_ENABLED`). Never used for paid operations.
   */
  async browseCatalog(): Promise<LibraryVoice[]> {
    const res = await this.http.request({
      method: "GET",
      url: `${this.base()}/v2/voices?page_size=100`,
      headers: { "xi-api-key": this.key() },
      timeoutMs: 30_000,
    });
    if (res.status >= 400) throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: this.providerId });
    if (typeof res.body === "string") {
      throw normalizeHttpProviderError({ status: 502, body: "html_instead_of_api_response", providerId: this.providerId });
    }
    return this.mapVoices(res.body);
  }

  /** Download a catalog preview MP3 (vendor CDN URL from the catalog — never sent to the browser). */
  async fetchPreview(url: string): Promise<Buffer> {
    const res = await this.http.request({ method: "GET", url, responseType: "binary", timeoutMs: 30_000 });
    if (res.status >= 400 || !Buffer.isBuffer(res.body)) {
      throw normalizeHttpProviderError({ status: res.status || 502, body: "preview_unavailable", providerId: this.providerId });
    }
    return res.body;
  }

  private mapVoices(body: unknown): LibraryVoice[] {
    const voices =
      (body as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string; category?: string }> })
        ?.voices ?? [];
    return voices.map((v) => ({
      providerVoiceId: v.voice_id,
      name: v.name,
      labels: {
        language: v.labels?.language,
        gender: v.labels?.gender,
        age: v.labels?.age,
        accent: v.labels?.accent,
      },
      previewUrl: v.preview_url ?? null,
      category: v.category,
    }));
  }

  /** Free to browse, but still network I/O → blocked until live execution is approved. */
  async listVoices(): Promise<LibraryVoice[]> {
    try {
      const res = await this.call({
        method: "GET",
        url: `${this.base()}/v2/voices?page_size=100`,
        headers: { "xi-api-key": this.key() },
        timeoutMs: 30_000,
      });
      const voices =
        (res.body as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string; category?: string }> })
          ?.voices ?? [];
      return voices.map((v) => ({
        providerVoiceId: v.voice_id,
        name: v.name,
        labels: {
          language: v.labels?.language,
          gender: v.labels?.gender,
          age: v.labels?.age,
          accent: v.labels?.accent,
        },
        previewUrl: v.preview_url ?? null,
        category: v.category,
      }));
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async submit(modelId: string, operation: string, input: unknown, _ctx: { idempotencyKey: string }): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    try {
      if (operation === "VOICE_CLONE") return await this.clone(VoiceCloneInputSchema.parse(input));
      if (operation === "VOICE_DESIGN") return await this.design(VoiceDesignInputSchema.parse(input), modelId);
      return await this.save(VoiceSaveInputSchema.parse(input));
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private async clone(input: z.infer<typeof VoiceCloneInputSchema>): Promise<ProviderSubmitResult> {
    const parts: MultipartPart[] = [{ name: "name", value: input.name }];
    if (input.description) parts.push({ name: "description", value: input.description });
    if (input.labels) parts.push({ name: "labels", value: JSON.stringify(input.labels) });
    if (input.removeBackgroundNoise != null) parts.push({ name: "remove_background_noise", value: String(input.removeBackgroundNoise) });
    for (const f of input.files) parts.push({ name: "files", filename: f.filename, contentType: f.contentType, data: f.data });
    // No Content-Type header: fetch sets the multipart boundary itself.
    const res = await this.call({
      method: "POST",
      url: `${this.base()}/v1/voices/add`,
      headers: { "xi-api-key": this.key() },
      multipart: parts,
      timeoutMs: 120_000,
    });
    const body = res.body as { voice_id?: string; requires_verification?: boolean };
    if (!body?.voice_id) throw { code: "PROVIDER_BAD_RESPONSE", message: "ElevenLabs: нет voice_id", retryable: false };
    return {
      status: "COMPLETED",
      providerJobId: `voice:${body.voice_id}`,
      outputs: [{ externalId: body.voice_id }],
      usage: { samples: input.files.length, requiresVerification: Boolean(body.requires_verification) },
    };
  }

  private async design(input: z.infer<typeof VoiceDesignInputSchema>, modelId: string): Promise<ProviderSubmitResult> {
    const res = await this.call({
      method: "POST",
      url: `${this.base()}/v1/text-to-voice/design`,
      headers: { "xi-api-key": this.key(), "Content-Type": "application/json" },
      body: {
        voice_description: input.voiceDescription,
        model_id: input.modelId ?? modelId ?? ElevenLabsVoiceAdapter.defaultDesignModelId,
        ...(input.text ? { text: input.text } : { auto_generate_text: true }),
      },
      timeoutMs: 120_000,
    });
    const previews =
      (res.body as { previews?: Array<{ generated_voice_id: string; audio_base_64: string; media_type?: string; duration_secs?: number }> })
        ?.previews ?? [];
    if (!previews.length) throw { code: "PROVIDER_BAD_RESPONSE", message: "ElevenLabs: нет вариантов голоса", retryable: true };
    return {
      status: "COMPLETED",
      providerJobId: `design:${previews[0]!.generated_voice_id}`,
      outputs: previews.map((p, i) => ({
        externalId: p.generated_voice_id,
        base64: p.audio_base_64,
        mimeType: p.media_type ?? "audio/mpeg",
        durationSecs: p.duration_secs,
        label: `Вариант ${i + 1}`,
      })),
      usage: { previews: previews.length },
    };
  }

  private async save(input: z.infer<typeof VoiceSaveInputSchema>): Promise<ProviderSubmitResult> {
    const res = await this.call({
      method: "POST",
      url: `${this.base()}/v1/text-to-voice`,
      headers: { "xi-api-key": this.key(), "Content-Type": "application/json" },
      body: {
        voice_name: input.voiceName,
        voice_description: input.voiceDescription,
        generated_voice_id: input.generatedVoiceId,
      },
      timeoutMs: 60_000,
    });
    const voiceId = (res.body as { voice_id?: string })?.voice_id;
    if (!voiceId) throw { code: "PROVIDER_BAD_RESPONSE", message: "ElevenLabs: нет voice_id", retryable: false };
    return { status: "COMPLETED", providerJobId: `voice:${voiceId}`, outputs: [{ externalId: voiceId }] };
  }

  mapError(err: unknown): NormalizedProviderError {
    if (typeof err === "object" && err !== null && "code" in err) return err as NormalizedProviderError;
    return mapTransportError(err, this.providerId);
  }
}
