ALTER TABLE "provider_job" ADD COLUMN IF NOT EXISTS "logical_operation_id" text;
ALTER TABLE "provider_job" ADD COLUMN IF NOT EXISTS "route_plan_version" integer DEFAULT 1;
ALTER TABLE "provider_job" ADD COLUMN IF NOT EXISTS "route_metadata" jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS "provider_job_logical_operation_id_idx" ON "provider_job" ("logical_operation_id");

CREATE TABLE IF NOT EXISTS "provider_logical_operation" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "scene_id" text,
  "run_id" text REFERENCES "agent_run"("id") ON DELETE SET NULL,
  "operation" text NOT NULL,
  "route_plan_version" integer NOT NULL DEFAULT 1,
  "latest_status" text NOT NULL,
  "plan_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_logical_operation_project_idx" ON "provider_logical_operation" ("project_id");
CREATE INDEX IF NOT EXISTS "provider_logical_operation_scene_idx" ON "provider_logical_operation" ("scene_id");
