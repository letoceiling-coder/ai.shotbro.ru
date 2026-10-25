import type { CanonicalSceneSettings } from "./types.js";
import { findCapability } from "../capability-matrix.js";

export type TranslationResult = {
  supported: Record<string, unknown>;
  warnings: string[];
  rejected: string[];
};

/** Maps canonical scene fields to provider-specific payload fragments (compatible subset only). */
export function translateCanonicalToProvider(
  settings: CanonicalSceneSettings,
  providerId: string,
  modelId: string,
): TranslationResult {
  const cap = findCapability(providerId, modelId, settings.operation);
  const warnings: string[] = [];
  const rejected: string[] = [];
  const supported: Record<string, unknown> = {};

  if (!cap) {
    rejected.push("unknown_capability");
    return { supported, warnings, rejected };
  }

  if (settings.operation === "IMAGE_GENERATION" || settings.operation === "TEXT_TO_VIDEO") {
    if (settings.aspectRatio) supported.aspect_ratio = settings.aspectRatio;
    if (settings.durationSeconds && cap.operation === "TEXT_TO_VIDEO") {
      supported.duration_seconds = settings.durationSeconds;
    }
    if (settings.referenceAssetIds?.length && cap.inputTypes.includes("image_optional")) {
      supported.reference_asset_ids = settings.referenceAssetIds;
    } else if (settings.referenceAssetIds?.length) {
      warnings.push("reference_assets_not_supported");
    }
  }

  if (settings.operation === "TEXT_TO_SPEECH") {
    if (settings.voiceId) supported.voice = settings.voiceId;
    if (settings.language) supported.language = settings.language;
  }

  if (settings.operation === "IMAGE_UPSCALE") {
    if (settings.firstFrameAssetId) supported.image = settings.firstFrameAssetId;
    if (settings.resolution) warnings.push("resolution_mapped_to_scale_factor_manually");
  }

  return { supported, warnings, rejected };
}
