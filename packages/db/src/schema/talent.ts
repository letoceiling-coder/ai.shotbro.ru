import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { asset } from "./asset.js";
import { workspace } from "./workspace.js";

/** Phase 6: reusable voice (workspace scope). Status values: see TalentStatusSchema in contracts. */
export const voiceProfile = pgTable(
  "voice_profile",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    provider: text("provider").notNull().default("elevenlabs"),
    providerVoiceId: text("provider_voice_id"),
    kind: text("kind").notNull(),
    labels: jsonb("labels").$type<Record<string, string>>().notNull().default({}),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    previewAssetId: text("preview_asset_id").references(() => asset.id, { onDelete: "set null" }),
    previewUrl: text("preview_url"),
    sampleAssetIds: jsonb("sample_asset_ids").$type<string[]>().notNull().default([]),
    designPrompt: text("design_prompt"),
    consentAssetId: text("consent_asset_id").references(() => asset.id, { onDelete: "set null" }),
    consentConfirmedAt: timestamp("consent_confirmed_at", { withTimezone: true }),
    consentTextVersion: text("consent_text_version"),
    status: text("status").notNull().default("DRAFT"),
    providerJobId: text("provider_job_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("voice_profile_workspace_idx").on(t.workspaceId)],
);

/** Phase 6: reusable avatar (workspace scope). PHOTO = HeyGen persistent; REFERENCE = photos as video references. */
export const avatarProfile = pgTable(
  "avatar_profile",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    kind: text("kind").notNull().default("REFERENCE"),
    provider: text("provider"),
    providerGroupId: text("provider_group_id"),
    sourceAssetIds: jsonb("source_asset_ids").$type<string[]>().notNull().default([]),
    defaultVoiceProfileId: text("default_voice_profile_id").references(() => voiceProfile.id, {
      onDelete: "set null",
    }),
    consentAssetId: text("consent_asset_id").references(() => asset.id, { onDelete: "set null" }),
    consentConfirmedAt: timestamp("consent_confirmed_at", { withTimezone: true }),
    consentTextVersion: text("consent_text_version"),
    status: text("status").notNull().default("DRAFT"),
    providerJobId: text("provider_job_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("avatar_profile_workspace_idx").on(t.workspaceId)],
);

export const avatarLook = pgTable(
  "avatar_look",
  {
    id: text("id").primaryKey(),
    avatarId: text("avatar_id")
      .notNull()
      .references(() => avatarProfile.id, { onDelete: "cascade" }),
    providerLookId: text("provider_look_id"),
    label: text("label").notNull(),
    previewAssetId: text("preview_asset_id").references(() => asset.id, { onDelete: "set null" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("avatar_look_avatar_idx").on(t.avatarId)],
);
