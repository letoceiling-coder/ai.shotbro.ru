DO $$ BEGIN
  CREATE TYPE "provider_job_status" AS ENUM(
    'CREATED',
    'AUTHORIZED',
    'SUBMITTING',
    'SUBMITTED',
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCEL_REQUESTED',
    'CANCELLED',
    'TIMED_OUT',
    'NEEDS_RECONCILIATION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "provider_job" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "run_id" text REFERENCES "agent_run"("id") ON DELETE SET NULL,
  "scene_id" text,
  "graph_node_id" text,
  "provider_id" text NOT NULL,
  "model_id" text NOT NULL,
  "operation" text NOT NULL,
  "status" "provider_job_status" DEFAULT 'CREATED' NOT NULL,
  "provider_job_id" text,
  "input_hash" text,
  "idempotency_key" text UNIQUE,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "submitted_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "output_asset_ids" jsonb DEFAULT '[]'::jsonb,
  "estimated_cost" numeric(12, 4),
  "actual_usage" jsonb,
  "failure_code" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "provider_job_project_id_idx" ON "provider_job" ("project_id");
CREATE INDEX IF NOT EXISTS "provider_job_run_id_idx" ON "provider_job" ("run_id");
CREATE INDEX IF NOT EXISTS "provider_job_status_idx" ON "provider_job" ("status");

CREATE TABLE IF NOT EXISTS "provider_job_event" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_job_id" text NOT NULL REFERENCES "provider_job"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "idempotency_key" text UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_execution_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_job_id" text NOT NULL REFERENCES "provider_job"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "status" text NOT NULL,
  "request_payload" jsonb,
  "response_payload" jsonb,
  "error_code" text,
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
