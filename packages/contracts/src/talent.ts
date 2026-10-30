import { z } from "zod";

/**
 * Phase 6 — reusable avatars and voices (workspace scope).
 * A project character references these by id; one avatar/voice serves many projects.
 */

export const TalentStatusSchema = z.enum([
  "DRAFT",
  "AWAITING_APPROVAL",
  "CREATING",
  "READY",
  "FAILED",
  "ARCHIVED",
]);
export type TalentStatus = z.infer<typeof TalentStatusSchema>;

/** Consent of the real person whose voice/face is used. Required for CLONED voices and PHOTO avatars. */
export const TalentConsentSchema = z.object({
  consentAssetId: z.string().min(1),
  confirmedAt: z.string(),
  textVersion: z.string().min(1),
});
export type TalentConsent = z.infer<typeof TalentConsentSchema>;

export const CONSENT_TEXT_VERSION = "2026-10-30.v1";

export const VoiceKindSchema = z.enum(["LIBRARY", "CLONED", "DESIGNED"]);
export type VoiceKind = z.infer<typeof VoiceKindSchema>;

export const VoiceLabelsSchema = z.object({
  language: z.string().max(40).optional(),
  gender: z.string().max(20).optional(),
  age: z.string().max(20).optional(),
  accent: z.string().max(40).optional(),
});

export const VoiceSettingsSchema = z.object({
  modelId: z.string().max(80).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

export const VoiceProfileSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  provider: z.literal("elevenlabs"),
  providerVoiceId: z.string().nullable().optional(),
  kind: VoiceKindSchema,
  labels: VoiceLabelsSchema.default({}),
  settings: VoiceSettingsSchema.default({}),
  previewAssetId: z.string().nullable().optional(),
  previewUrl: z.string().nullable().optional(),
  sampleAssetIds: z.array(z.string()).default([]),
  /** Voice Design: description used to generate previews. */
  designPrompt: z.string().nullable().optional(),
  /** Voice Design previews (stored in MinIO); user picks one → VOICE_SAVE. */
  previews: z
    .array(z.object({ generatedVoiceId: z.string(), label: z.string(), assetId: z.string().nullable(), durationSecs: z.number().optional() }))
    .default([]),
  lastError: z.string().nullable().optional(),
  consent: TalentConsentSchema.nullable().optional(),
  status: TalentStatusSchema,
  mock: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

export const CreateVoiceProfileInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LIBRARY"),
    name: z.string().min(1).max(120),
    providerVoiceId: z.string().min(1).max(120),
    labels: VoiceLabelsSchema.optional(),
    settings: VoiceSettingsSchema.optional(),
    previewUrl: z.string().url().optional(),
  }),
  z.object({
    kind: z.literal("CLONED"),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    labels: VoiceLabelsSchema.optional(),
    sampleAssetIds: z.array(z.string().min(1)).min(1).max(5),
    removeBackgroundNoise: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("DESIGNED"),
    name: z.string().min(1).max(120),
    /** ElevenLabs Voice Design requires 20–1000 characters. */
    designPrompt: z.string().min(20).max(1000),
    labels: VoiceLabelsSchema.optional(),
  }),
]);
export type CreateVoiceProfileInput = z.infer<typeof CreateVoiceProfileInputSchema>;

export const UpdateVoiceProfileInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  labels: VoiceLabelsSchema.optional(),
  settings: VoiceSettingsSchema.optional(),
});

export const AttachConsentInputSchema = z.object({
  consentAssetId: z.string().min(1),
  /** User ticked "I have the person's permission" for this exact text version. */
  confirmed: z.literal(true),
  textVersion: z.literal(CONSENT_TEXT_VERSION),
});

/** Entry of the provider voice catalog (ElevenLabs library) — read-only, free to browse. */
export const LibraryVoiceSchema = z.object({
  providerVoiceId: z.string(),
  name: z.string(),
  labels: VoiceLabelsSchema.default({}),
  previewUrl: z.string().nullable().optional(),
  category: z.string().optional(),
  mock: z.boolean().optional(),
});
export type LibraryVoice = z.infer<typeof LibraryVoiceSchema>;

/** PHOTO: persistent HeyGen photo avatar. REFERENCE: photos used as references for Fal/OpenRouter video. */
export const AvatarKindSchema = z.enum(["PHOTO", "REFERENCE"]);
export type AvatarKind = z.infer<typeof AvatarKindSchema>;

export const AvatarProviderSchema = z.enum(["heygen", "fal", "openrouter"]);
export type AvatarProvider = z.infer<typeof AvatarProviderSchema>;

export const AvatarLookSchema = z.object({
  id: z.string(),
  avatarId: z.string(),
  providerLookId: z.string().nullable().optional(),
  label: z.string(),
  previewAssetId: z.string().nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});
export type AvatarLook = z.infer<typeof AvatarLookSchema>;

export const AvatarProfileSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  kind: AvatarKindSchema,
  provider: AvatarProviderSchema.nullable().optional(),
  providerGroupId: z.string().nullable().optional(),
  sourceAssetIds: z.array(z.string()),
  defaultVoiceProfileId: z.string().nullable().optional(),
  consent: TalentConsentSchema.nullable().optional(),
  status: TalentStatusSchema,
  looks: z.array(AvatarLookSchema).default([]),
  mock: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AvatarProfile = z.infer<typeof AvatarProfileSchema>;

export const CreateAvatarProfileInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  sourceAssetIds: z.array(z.string().min(1)).min(1).max(10),
  defaultVoiceProfileId: z.string().optional(),
});
export type CreateAvatarProfileInput = z.infer<typeof CreateAvatarProfileInputSchema>;

export const UpdateAvatarProfileInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  defaultVoiceProfileId: z.string().nullable().optional(),
});

/** Link a project character to reusable talent. null clears the link. */
export const AssignCharacterTalentInputSchema = z.object({
  voiceProfileId: z.string().nullable().optional(),
  avatarProfileId: z.string().nullable().optional(),
  avatarLookId: z.string().nullable().optional(),
});
export type AssignCharacterTalentInput = z.infer<typeof AssignCharacterTalentInputSchema>;

/** Capability the server resolves a provider for (customer priority: HeyGen → Fal → OpenRouter). */
export const MediaCapabilitySchema = z.enum(["AVATAR_TRAIN", "AVATAR_VIDEO", "SCENE_VIDEO"]);
export type MediaCapability = z.infer<typeof MediaCapabilitySchema>;

export const ProviderChoiceSchema = z.object({
  providerId: AvatarProviderSchema,
  available: z.boolean(),
  /** Human-readable Russian reason shown to the user and the agent. */
  reason: z.string(),
  /** PHOTO avatar identity is persistent only on HeyGen. */
  persistentIdentity: z.boolean(),
});
export type ProviderChoice = z.infer<typeof ProviderChoiceSchema>;

export const ProviderChainSchema = z.object({
  capability: MediaCapabilitySchema,
  selected: AvatarProviderSchema.nullable(),
  chain: z.array(ProviderChoiceSchema),
  mockMode: z.boolean(),
});
export type ProviderChain = z.infer<typeof ProviderChainSchema>;

/** Phase 6B: talent operations executed by the worker through provider adapters. */
export const TalentOperationSchema = z.enum(["VOICE_CLONE", "VOICE_DESIGN", "VOICE_SAVE", "AVATAR_TRAIN"]);
export type TalentOperation = z.infer<typeof TalentOperationSchema>;

export const StartTalentOperationInputSchema = z.object({
  /** Project context: outputs are stored as project assets; costs land on its ledger. */
  projectId: z.string().min(1),
  operation: TalentOperationSchema,
  voiceProfileId: z.string().optional(),
  avatarProfileId: z.string().optional(),
  /** VOICE_SAVE: which design preview to keep. */
  generatedVoiceId: z.string().optional(),
  /** Phase 6C: required in live mode; ignored in mock mode. */
  approvalId: z.string().optional(),
});
export type StartTalentOperationInput = z.infer<typeof StartTalentOperationInputSchema>;

export const TalentJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  operation: TalentOperationSchema,
  providerId: z.string(),
  status: z.string(),
  talentType: z.enum(["voice", "avatar"]),
  talentId: z.string(),
  failureCode: z.string().nullable().optional(),
  mock: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TalentJob = z.infer<typeof TalentJobSchema>;

/** Phase 6C: ask for a price + approval card before any paid talent operation. */
export const TalentQuoteInputSchema = StartTalentOperationInputSchema.omit({ approvalId: true }).extend({
  /** Chat where the approval card appears; defaults to the project's first conversation. */
  conversationId: z.string().optional(),
});
export type TalentQuoteInput = z.infer<typeof TalentQuoteInputSchema>;

export const TalentQuoteResultSchema = z.object({
  approvalId: z.string().nullable(),
  messageId: z.string().nullable(),
  /** Needed to approve/reject via POST /approvals/:id/{approve|reject}. */
  payloadHash: z.string().nullable(),
  targetVersion: z.string().nullable(),
  operation: TalentOperationSchema,
  providerId: z.string(),
  estimatedLiveUsd: z.number(),
  chargedUsd: z.number(),
  priceStatus: z.enum(["ESTIMATED", "INCLUDED_IN_PLAN", "FREE"]),
  note: z.string(),
  mock: z.boolean(),
  /** true when no approval is needed (free REFERENCE avatar). */
  free: z.boolean(),
});
export type TalentQuoteResult = z.infer<typeof TalentQuoteResultSchema>;
