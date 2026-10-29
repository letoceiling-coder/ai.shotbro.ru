import { createHash } from "node:crypto";
import type { LibraryVoice } from "@shotbro/contracts";
import type { MediaProviderAdapter, NormalizedProviderError, ProviderCostEstimate, ProviderSubmitResult } from "./provider-contracts.js";
import { AvatarOperationSchema, VoiceOperationSchema } from "./provider-contracts.js";
import { HeyGenAvatarVideoInputSchema, HeyGenTrainInputSchema } from "./heygen-avatar-adapter.js";
import { VoiceCloneInputSchema, VoiceDesignInputSchema, VoiceSaveInputSchema } from "./elevenlabs-voice-adapter.js";

/** Deterministic ids so retries with the same input map to the same mock entity. */
function mockId(prefix: string, input: unknown) {
  const json = JSON.stringify(input, (_k, v) => (Buffer.isBuffer(v) ? `buf:${v.length}` : v));
  return `${prefix}-${createHash("sha256").update(json).digest("hex").slice(0, 12)}`;
}

const MOCK_COST: ProviderCostEstimate = { amountUsd: 0, priceStatus: "KNOWN", currency: "USD", billingUnit: "mock" };

/** Library shown in mock mode: Russian-first, mirrors the ElevenLabs catalog shape. */
export const MOCK_LIBRARY_VOICES: LibraryVoice[] = [
  { providerVoiceId: "mock-ru-male-1", name: "Алексей — диктор", labels: { language: "ru", gender: "male", age: "middle_aged", accent: "russian" }, previewUrl: null, category: "premade", mock: true },
  { providerVoiceId: "mock-ru-female-1", name: "Мария — тёплый", labels: { language: "ru", gender: "female", age: "young", accent: "russian" }, previewUrl: null, category: "premade", mock: true },
  { providerVoiceId: "mock-ru-male-2", name: "Игорь — энергичный", labels: { language: "ru", gender: "male", age: "young", accent: "russian" }, previewUrl: null, category: "premade", mock: true },
  { providerVoiceId: "mock-en-female-1", name: "Emma — narrator", labels: { language: "en", gender: "female", age: "middle_aged", accent: "american" }, previewUrl: null, category: "premade", mock: true },
];

export class MockHeyGenAvatarProvider implements MediaProviderAdapter {
  readonly providerId = "mock-heygen";
  readonly modality = "video" as const;

  getCapabilities() {
    return { operations: [...AvatarOperationSchema.options], async: true, supportsCancel: false, maxDurationSeconds: 60 };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    const op = AvatarOperationSchema.parse(operation);
    if (op === "AVATAR_TRAIN") HeyGenTrainInputSchema.parse(input);
    else HeyGenAvatarVideoInputSchema.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return MOCK_COST;
  }

  async uploadPhoto(photo: Buffer): Promise<string> {
    return mockId("mock-image-key", { len: photo.length, head: photo.subarray(0, 32).toString("hex") });
  }

  async submit(modelId: string, operation: string, input: unknown): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    if (operation === "AVATAR_TRAIN") {
      return { status: "SUBMITTED", providerJobId: `train:${mockId("mock-group", input)}`, usage: { mock: true } };
    }
    return { status: "SUBMITTED", providerJobId: `video:${mockId("mock-video", input)}`, usage: { mock: true } };
  }

  /** Mock jobs complete on the first poll. */
  async getStatus(providerJobId: string) {
    const [kind, id] = providerJobId.split(":", 2);
    if (kind === "train") {
      return {
        status: "COMPLETED",
        outputs: [
          { externalId: `${id}-look-1`, label: "Образ 1", mock: true, mimeType: "image/png" },
          { externalId: `${id}-look-2`, label: "Образ 2", mock: true, mimeType: "image/png" },
        ],
      };
    }
    return { status: "COMPLETED", outputs: [{ mock: true, mimeType: "video/mp4", durationSecs: 10 }] };
  }

  mapError(err: unknown): NormalizedProviderError {
    return { code: "MOCK_HEYGEN_ERROR", message: err instanceof Error ? err.message : "error", retryable: false };
  }
}

export class MockElevenLabsVoiceProvider implements MediaProviderAdapter {
  readonly providerId = "mock-elevenlabs";
  readonly modality = "audio" as const;

  getCapabilities() {
    return { operations: [...VoiceOperationSchema.options], async: false, supportsCancel: false };
  }

  validateRequest(_modelId: string, operation: string, input: unknown) {
    const op = VoiceOperationSchema.parse(operation);
    if (op === "VOICE_CLONE") VoiceCloneInputSchema.parse(input);
    else if (op === "VOICE_DESIGN") VoiceDesignInputSchema.parse(input);
    else VoiceSaveInputSchema.parse(input);
  }

  estimateCost(): ProviderCostEstimate {
    return MOCK_COST;
  }

  async listVoices(): Promise<LibraryVoice[]> {
    return MOCK_LIBRARY_VOICES;
  }

  async submit(modelId: string, operation: string, input: unknown): Promise<ProviderSubmitResult> {
    this.validateRequest(modelId, operation, input);
    if (operation === "VOICE_DESIGN") {
      const base = mockId("mock-gen", input);
      return {
        status: "COMPLETED",
        providerJobId: `design:${base}`,
        outputs: [1, 2, 3].map((i) => ({ externalId: `${base}-${i}`, label: `Вариант ${i}`, mock: true, mimeType: "audio/mpeg", durationSecs: 6 })),
        usage: { mock: true, previews: 3 },
      };
    }
    const voiceId = mockId("mock-voice", input);
    return { status: "COMPLETED", providerJobId: `voice:${voiceId}`, outputs: [{ externalId: voiceId, mock: true }], usage: { mock: true } };
  }

  mapError(err: unknown): NormalizedProviderError {
    return { code: "MOCK_VOICE_ERROR", message: err instanceof Error ? err.message : "error", retryable: false };
  }
}
