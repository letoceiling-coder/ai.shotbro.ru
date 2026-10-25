import type { ProviderOperation } from "../capability-matrix.js";

export type FallbackMode = "disabled" | "automatic_compatible" | "ask_before_switch";

export type CanonicalSceneSettings = {
  sceneId: string;
  operation: ProviderOperation;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  referenceAssetIds?: string[];
  voiceId?: string;
  language?: string;
  strictVoiceConsistency?: boolean;
  primaryProviderId?: string;
  primaryModelId?: string;
  fallbackMode?: FallbackMode;
  approvedMaxCostUsd?: number;
  reservedBudgetUsd?: number;
  consumedBudgetUsd?: number;
};

export type RouteCandidate = {
  providerId: string;
  modelId: string;
  operation: ProviderOperation;
  priceStatus: "KNOWN" | "UNKNOWN";
  estimatedUsd?: number;
  compatible: boolean;
  incompatibilityReasons?: string[];
};

export type ProviderRoutePlan = {
  operation: ProviderOperation;
  primary: RouteCandidate | null;
  fallbacks: RouteCandidate[];
  selected?: RouteCandidate;
  fallbackReason?: string;
  status:
    | "PRIMARY_SELECTED"
    | "FALLBACK_PLANNED"
    | "NO_COMPATIBLE_FALLBACK"
    | "RE_APPROVAL_REQUIRED"
    | "NEEDS_RECONCILIATION"
    | "PRICING_BLOCKED"
    | "FALLBACK_BLOCKED_VOICE";
  events: Array<{ type: string; message: string }>;
  originalSettingsSnapshot: CanonicalSceneSettings;
  translatedSettingsSnapshot?: Record<string, unknown>;
};

export type SubmitFailureClass = "PRE_SUBMIT_FAILURE" | "POST_SUBMIT_AMBIGUOUS";
