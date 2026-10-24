import type { ModelParameterDefinition } from "./types.js";
import { MagnificEngineSchema, MagnificOptimizedForSchema } from "../providers/magnific-image-upscaler-adapter.js";

const magnificOptimized = MagnificOptimizedForSchema.options;
const magnificEngines = MagnificEngineSchema.options;

export const MODEL_PARAMETER_REGISTRY: ModelParameterDefinition[] = [
  {
    providerId: "magnific",
    modelId: "magnific/image-upscaler-creative",
    operation: "IMAGE_UPSCALE",
    displayName: "Magnific Creative Upscaler",
    documentationUrl: "https://docs.magnific.com/api-reference/image-upscaler-creative/post-image-upscaler",
    defaultParameters: {
      scale_factor: "4x",
      optimized_for: "standard",
      creativity: 0,
      hdr: 0,
      resemblance: 0,
      fractality: 0,
      engine: "automatic",
    },
    presets: [
      {
        id: "portrait_preservation",
        label: "Portrait Preservation",
        description: "Higher resemblance, softer portraits profile (mock-tuned defaults).",
        parameters: { optimized_for: "soft_portraits", resemblance: 3, creativity: -2, hdr: 1 },
      },
      {
        id: "character_consistency",
        label: "Character Consistency",
        description: "Favor resemblance over creative drift.",
        parameters: { optimized_for: "hard_portraits", resemblance: 4, creativity: -3, fractality: 1 },
      },
      {
        id: "cinematic_detail",
        label: "Cinematic Detail",
        description: "Film/photo look with moderate HDR.",
        parameters: { optimized_for: "films_n_photography", hdr: 2, creativity: -1, engine: "magnific_sparkle" },
      },
      {
        id: "product_photography",
        label: "Product Photography",
        description: "Clean detail for product frames.",
        parameters: { optimized_for: "standard", resemblance: 2, creativity: -2, fractality: 0 },
      },
      {
        id: "illustration_enhancement",
        label: "Illustration Enhancement",
        description: "Art/illustration optimized profile.",
        parameters: { optimized_for: "art_n_illustration", creativity: 1, hdr: 1, engine: "magnific_illusio" },
      },
    ],
    parameterSchema: [
      {
        key: "scale_factor",
        type: "enum",
        label: "Scale factor",
        description: "Output resolution multiplier (async job duration grows with scale).",
        enumValues: ["2x", "4x", "8x", "16x"],
        default: "4x",
        uiGroup: "basic",
        uiOrder: 1,
        required: true,
      },
      {
        key: "optimized_for",
        type: "enum",
        label: "Optimized for",
        enumValues: [...magnificOptimized],
        default: "standard",
        uiGroup: "basic",
        uiOrder: 2,
      },
      {
        key: "prompt",
        type: "string",
        label: "Prompt",
        description: "Guide enhancement; reuse generation prompt when possible.",
        uiGroup: "basic",
        uiOrder: 3,
      },
      {
        key: "engine",
        type: "enum",
        label: "Engine",
        enumValues: [...magnificEngines],
        default: "automatic",
        uiGroup: "advanced",
        uiOrder: 10,
      },
      {
        key: "creativity",
        type: "integer",
        label: "Creativity",
        minimum: -10,
        maximum: 10,
        default: 0,
        uiGroup: "advanced",
        uiOrder: 11,
      },
      {
        key: "hdr",
        type: "integer",
        label: "HDR / definition",
        minimum: -10,
        maximum: 10,
        default: 0,
        uiGroup: "advanced",
        uiOrder: 12,
      },
      {
        key: "resemblance",
        type: "integer",
        label: "Resemblance",
        minimum: -10,
        maximum: 10,
        default: 0,
        uiGroup: "advanced",
        uiOrder: 13,
      },
      {
        key: "fractality",
        type: "integer",
        label: "Fractality",
        minimum: -10,
        maximum: 10,
        default: 0,
        uiGroup: "expert",
        uiOrder: 20,
      },
    ],
  },
  {
    providerId: "mock-image",
    modelId: "mock/image",
    operation: "TEXT_TO_IMAGE",
    displayName: "Mock Image",
    defaultParameters: { steps: 20, guidance: 7 },
    presets: [
      { id: "default", label: "DEFAULT", description: "Balanced mock image settings.", parameters: {} },
      { id: "economy", label: "ECONOMY", description: "Fewer mock steps.", parameters: { steps: 12 } },
      { id: "quality", label: "QUALITY", description: "Higher mock steps.", parameters: { steps: 28 } },
    ],
    parameterSchema: [
      {
        key: "steps",
        type: "integer",
        label: "Steps",
        minimum: 4,
        maximum: 50,
        default: 20,
        uiGroup: "basic",
        uiOrder: 1,
      },
      {
        key: "guidance",
        type: "number",
        label: "Guidance",
        minimum: 1,
        maximum: 20,
        step: 0.5,
        default: 7,
        uiGroup: "basic",
        uiOrder: 2,
      },
    ],
  },
];

export function getModelParameterDefinition(modelId: string, operation?: string) {
  return MODEL_PARAMETER_REGISTRY.find(
    (d) => d.modelId === modelId && (!operation || d.operation === operation),
  );
}
