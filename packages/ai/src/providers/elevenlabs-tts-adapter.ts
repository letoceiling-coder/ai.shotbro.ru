import { z } from "zod";
import { getElevenLabsConfig } from "@shotbro/config/vendor-providers";
import type { AppEnv } from "@shotbro/config/env";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type {
  MediaProviderAdapter,
  NormalizedProviderError,
  ProviderCostEstimate,
  ProviderSubmitResult,
} from "./provider-contracts.js";
import { AudioOperationSchema } from "./provider-contracts.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { normalizeHttpProviderError, mapTransportError } from "./provider-http-errors.js";

const ttsInput = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1),
  model_id: z.string().optional(),
  output_format: z.string().optional(),
});

/** ElevenLabs POST /v1/text-to-speech/{voice_id} (sync audio response). */
export class ElevenLabsTtsAdapter implements MediaProviderAdapter {
  readonly providerId = "elevenlabs";
  readonly modality = "audio" as const;
  static readonly defaultModelId = "eleven_multilingual_v2";

  private readonly policy: ExecutionPolicyEngine;

  constructor(
    private readonly env: AppEnv,
    private readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  getCapabilities(modelId: string) {
    return {
      operations: [AudioOperationSchema.enum.TEXT_TO_SPEECH],
      async: false,
      supportsCancel: false,
      maxDurationSeconds: 120,
    };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    AudioOperationSchema.parse(operation);
    ttsInput.parse(input);
  }

  estimateCost(modelId: string, operation: string, input: unknown): ProviderCostEstimate {
    this.validateRequest(modelId, operation, input);
    return { amountUsd: 0, priceStatus: "UNKNOWN", currency: "USD", billingUnit: "character" };
  }

  async submit(
    modelId: string,
    operation: string,
    input: unknown,
    _ctx: { idempotencyKey: string },
  ): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    const parsed = ttsInput.parse(input);
    const cfg = getElevenLabsConfig(this.env);
    this.policy.assertProviderNetworkCall();

    try {
      const res = await this.http.request({
        method: "POST",
        url: `${cfg.baseUrl}/v1/text-to-speech/${encodeURIComponent(parsed.voiceId)}`,
        headers: {
          "xi-api-key": cfg.hasApiKey ? this.env.ELEVENLABS_API_KEY! : "",
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: {
          text: parsed.text,
          model_id: parsed.model_id ?? modelId ?? ElevenLabsTtsAdapter.defaultModelId,
          output_format: parsed.output_format,
        },
        timeoutMs: 120_000,
        responseType: "binary",
      });

      if (res.status >= 400) {
        throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: this.providerId });
      }

      // Sync endpoint: the MP3 bytes come back directly; we ingest them into MinIO (never a vendor URL).
      if (!Buffer.isBuffer(res.body) || res.body.length === 0) {
        throw normalizeHttpProviderError({ status: 502, body: "empty audio response", providerId: this.providerId });
      }

      return {
        status: "COMPLETED",
        providerJobId: `elevenlabs-${Date.now()}`,
        outputs: [{ mimeType: "audio/mpeg", base64: res.body.toString("base64") }],
        usage: { characters: parsed.text.length, model_id: parsed.model_id ?? modelId },
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  mapError(err: unknown): NormalizedProviderError {
    if (typeof err === "object" && err !== null && "code" in err) {
      return err as NormalizedProviderError;
    }
    return mapTransportError(err, this.providerId);
  }
}
