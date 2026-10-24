export type ModelExecutionStatus =
  | "MOCK_READY"
  | "CONTRACT_READY"
  | "DEPLOYED_DISABLED"
  | "LIVE_UNVERIFIED"
  | "BLOCKED_BY_POLICY"
  | "ADAPTER_PENDING";

export type CatalogModelEntry = {
  provider: string;
  modelId: string;
  displayName: string;
  supportedOperations: string[];
  durationSeconds?: { min?: number; max?: number };
  resolution?: string;
  referenceCapabilities?: string[];
  constraints?: string[];
  pricingSource: "UNKNOWN" | "VENDOR_DOC" | "OPENROUTER" | "INTERNAL_ESTIMATE";
  pricingUsd?: number;
  priceStatus: "KNOWN" | "UNKNOWN";
  verificationDate: string;
  availability: "MOCK" | "CONFIGURED" | "UNVERIFIED";
  executionStatus: ModelExecutionStatus;
};

/** Verified against vendor docs on 2026-10-24 — no live inference performed. */
export const PHASE4_MODEL_CATALOG: CatalogModelEntry[] = [
  {
    provider: "mock",
    modelId: "mock/text",
    displayName: "Mock Text",
    supportedOperations: ["text"],
    pricingSource: "INTERNAL_ESTIMATE",
    priceStatus: "KNOWN",
    pricingUsd: 0,
    verificationDate: "2026-10-24",
    availability: "MOCK",
    executionStatus: "MOCK_READY",
  },
  {
    provider: "openrouter",
    modelId: "openrouter/auto",
    displayName: "OpenRouter Auto",
    supportedOperations: ["text"],
    pricingSource: "OPENROUTER",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    availability: "CONFIGURED",
    executionStatus: "BLOCKED_BY_POLICY",
  },
  {
    provider: "fal-flux",
    modelId: "fal-ai/flux/dev",
    displayName: "FLUX.1 [dev] (Fal queue)",
    supportedOperations: ["TEXT_TO_IMAGE"],
    resolution: "configurable",
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    availability: "UNVERIFIED",
    executionStatus: "CONTRACT_READY",
  },
  {
    provider: "fal-minimax-video",
    modelId: "minimax/h3/text-to-video",
    displayName: "MiniMax H3 Text-to-Video (Fal queue)",
    supportedOperations: ["TEXT_TO_VIDEO"],
    durationSeconds: { max: 120 },
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    availability: "UNVERIFIED",
    executionStatus: "CONTRACT_READY",
  },
  {
    provider: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    displayName: "ElevenLabs Multilingual v2",
    supportedOperations: ["TEXT_TO_SPEECH"],
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-24",
    availability: "UNVERIFIED",
    executionStatus: "CONTRACT_READY",
  },
  {
    provider: "mock-image",
    modelId: "mock/image",
    displayName: "Mock Image",
    supportedOperations: ["TEXT_TO_IMAGE", "IMAGE_TO_IMAGE"],
    priceStatus: "KNOWN",
    pricingUsd: 0,
    pricingSource: "INTERNAL_ESTIMATE",
    verificationDate: "2026-10-24",
    availability: "MOCK",
    executionStatus: "MOCK_READY",
  },
  {
    provider: "mock-video",
    modelId: "mock/video",
    displayName: "Mock Video",
    supportedOperations: ["TEXT_TO_VIDEO"],
    priceStatus: "KNOWN",
    pricingUsd: 0,
    pricingSource: "INTERNAL_ESTIMATE",
    verificationDate: "2026-10-24",
    availability: "MOCK",
    executionStatus: "MOCK_READY",
  },
  {
    provider: "mock-elevenlabs",
    modelId: "mock/audio",
    displayName: "Mock TTS",
    supportedOperations: ["TEXT_TO_SPEECH"],
    priceStatus: "KNOWN",
    pricingUsd: 0,
    pricingSource: "INTERNAL_ESTIMATE",
    verificationDate: "2026-10-24",
    availability: "MOCK",
    executionStatus: "MOCK_READY",
  },
  {
    provider: "magnific",
    modelId: "magnific/image-upscaler-creative",
    displayName: "Magnific Creative Upscaler",
    supportedOperations: ["IMAGE_UPSCALE"],
    resolution: "up to 16x (vendor)",
    referenceCapabilities: ["image_url", "base64"],
    pricingSource: "VENDOR_DOC",
    priceStatus: "UNKNOWN",
    verificationDate: "2026-10-25",
    availability: "CONFIGURED",
    executionStatus: "BLOCKED_BY_POLICY",
  },
  {
    provider: "mock-magnific",
    modelId: "mock/magnific-upscale",
    displayName: "Mock Magnific Upscale",
    supportedOperations: ["IMAGE_UPSCALE"],
    priceStatus: "KNOWN",
    pricingUsd: 0,
    pricingSource: "INTERNAL_ESTIMATE",
    verificationDate: "2026-10-25",
    availability: "MOCK",
    executionStatus: "MOCK_READY",
  },
];

export function getCatalogModel(modelId: string): CatalogModelEntry | undefined {
  return PHASE4_MODEL_CATALOG.find((m) => m.modelId === modelId);
}
