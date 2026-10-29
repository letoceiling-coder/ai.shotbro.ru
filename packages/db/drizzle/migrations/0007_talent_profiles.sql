-- Phase 6A: reusable avatars and voices (workspace scope). Additive only, idempotent.
CREATE TABLE IF NOT EXISTS "voice_profile" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "description" text,
  "provider" text NOT NULL DEFAULT 'elevenlabs',
  "provider_voice_id" text,
  "kind" text NOT NULL,
  "labels" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "preview_asset_id" text REFERENCES "asset"("id") ON DELETE SET NULL,
  "preview_url" text,
  "sample_asset_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "design_prompt" text,
  "consent_asset_id" text REFERENCES "asset"("id") ON DELETE SET NULL,
  "consent_confirmed_at" timestamptz,
  "consent_text_version" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "provider_job_id" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "voice_profile_workspace_idx" ON "voice_profile" ("workspace_id");

CREATE TABLE IF NOT EXISTS "avatar_profile" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "description" text,
  "kind" text NOT NULL DEFAULT 'REFERENCE',
  "provider" text,
  "provider_group_id" text,
  "source_asset_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "default_voice_profile_id" text REFERENCES "voice_profile"("id") ON DELETE SET NULL,
  "consent_asset_id" text REFERENCES "asset"("id") ON DELETE SET NULL,
  "consent_confirmed_at" timestamptz,
  "consent_text_version" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "provider_job_id" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "avatar_profile_workspace_idx" ON "avatar_profile" ("workspace_id");

CREATE TABLE IF NOT EXISTS "avatar_look" (
  "id" text PRIMARY KEY,
  "avatar_id" text NOT NULL REFERENCES "avatar_profile"("id") ON DELETE CASCADE,
  "provider_look_id" text,
  "label" text NOT NULL,
  "preview_asset_id" text REFERENCES "asset"("id") ON DELETE SET NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "avatar_look_avatar_idx" ON "avatar_look" ("avatar_id");
