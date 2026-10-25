/** Universal provider capability entries — verified from vendor docs (2026-10-25), no live calls. */

export type ProviderOperation =
  | "TEXT_GENERATION"
  | "IMAGE_GENERATION"
  | "IMAGE_EDIT"
  | "IMAGE_UPSCALE"
  | "TEXT_TO_VIDEO"
  | "IMAGE_TO_VIDEO"
  | "VIDEO_WITH_REFERENCES"
  | "TEXT_TO_SPEECH"
  | "SPEECH_TO_TEXT"
  | "AUDIO_GENERATION";

export type CapabilityEntry = {
  providerId: string;
  modelId: string;
  operation: ProviderOperation;
  inputTypes: string[];
  outputTypes: string[];
  capabilities: string[];
  constraints?: string[];
  pricingSource: "UNKNOWN" | "VENDOR_DOC" | "OPENROUTER" | "INTERNAL_ESTIMATE";
  priceStatus: "KNOWN" | "UNKNOWN";
  verificationDate: string;
  documentationUrl?: string;
  executionStatus: "MOCK_READY" | "CONTRACT_READY" | "BLOCKED_BY_POLICY" | "ADAPTER_PENDING";
};

export const PROVIDER_CAPABILITY_MATRIX: CapabilityEntry[] = [
  {
    providerId: "fal-flux",
    modelId: "fal-ai/flux/dev",
    operation: "IMAGE_GENERATION",
    inputTypes: ["text", "image_optional"],
    outputTypes: ["image"],
    capabilities: ["TEXT_TO_IMAGE", "async_queue"],
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    documentationUrl: "https://fal.ai/models/fal-ai/flux/dev/api",
    executionStatus: "CONTRACT_READY",
  },
  {
    providerId: "fal-minimax-video",
    modelId: "minimax/h3/text-to-video",
    operation: "TEXT_TO_VIDEO",
    inputTypes: ["text"],
    outputTypes: ["video"],
    capabilities: ["TEXT_TO_VIDEO", "async_queue"],
    constraints: ["model_specific_schema"],
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    documentationUrl: "https://fal.ai/models/minimax/h3/text-to-video/api",
    executionStatus: "CONTRACT_READY",
  },
  {
    providerId: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    operation: "TEXT_TO_SPEECH",
    inputTypes: ["text"],
    outputTypes: ["audio"],
    capabilities: ["voice_id", "output_format"],
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    documentationUrl: "https://elevenlabs.io/docs/api-reference/text-to-speech",
    executionStatus: "CONTRACT_READY",
  },
  {
    providerId: "magnific",
    modelId: "magnific/image-upscaler-creative",
    operation: "IMAGE_UPSCALE",
    inputTypes: ["image_base64", "image_url"],
    outputTypes: ["image"],
    capabilities: ["IMAGE_UPSCALE", "async_task"],
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-25",
    documentationUrl: "https://docs.magnific.com/api-reference/image-upscaler-creative/post-image-upscaler",
    executionStatus: "CONTRACT_READY",
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/auto",
    operation: "TEXT_GENERATION",
    inputTypes: ["text"],
    outputTypes: ["text"],
    capabilities: ["chat_completions"],
    pricingSource: "OPENROUTER",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-25",
    documentationUrl: "https://openrouter.ai/docs/api/reference/overview",
    executionStatus: "BLOCKED_BY_POLICY",
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/image/auto",
    operation: "IMAGE_GENERATION",
    inputTypes: ["text", "image_optional"],
    outputTypes: ["image"],
    capabilities: ["images_api"],
    pricingSource: "OPENROUTER",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-25",
    documentationUrl: "https://openrouter.ai/docs/features/multimodal/image-generation",
    executionStatus: "CONTRACT_READY",
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/video/auto",
    operation: "TEXT_TO_VIDEO",
    inputTypes: ["text", "image_optional"],
    outputTypes: ["video"],
    capabilities: ["videos_api", "async_job"],
    pricingSource: "OPENROUTER",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-25",
    documentationUrl: "https://openrouter.ai/docs/features/multimodal/video-generation",
    executionStatus: "CONTRACT_READY",
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/tts/auto",
    operation: "TEXT_TO_SPEECH",
    inputTypes: ["text"],
    outputTypes: ["audio"],
    capabilities: ["audio_speech_api"],
    pricingSource: "OPENROUTER",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-25",
    documentationUrl: "https://openrouter.ai/docs/features/multimodal/text-to-speech",
    executionStatus: "CONTRACT_READY",
  },
];

export function listCapabilities(filter?: { operation?: ProviderOperation; providerId?: string }) {
  return PROVIDER_CAPABILITY_MATRIX.filter((e) => {
    if (filter?.operation && e.operation !== filter.operation) return false;
    if (filter?.providerId && e.providerId !== filter.providerId) return false;
    return true;
  });
}

export function findCapability(providerId: string, modelId: string, operation: ProviderOperation) {
  return PROVIDER_CAPABILITY_MATRIX.find(
    (e) => e.providerId === providerId && e.modelId === modelId && e.operation === operation,
  );
}
