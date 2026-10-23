CREATE TYPE "public"."agent_production_state" AS ENUM('DRAFT', 'BRIEFING', 'PLANNING', 'WAITING_PLAN_APPROVAL', 'SCRIPTING', 'WAITING_SCRIPT_APPROVAL', 'STORYBOARDING', 'WAITING_STORYBOARD_APPROVAL', 'READY_FOR_PRODUCTION', 'WAITING_COST_APPROVAL', 'QUEUED', 'PRODUCING', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'COMPLETED', 'PAUSED', 'FAILED', 'CANCELLED', 'NEEDS_REVISION', 'BLOCKED_PROVIDER', 'BLOCKED_BUDGET');--> statement-breakpoint
CREATE TYPE "public"."production_doc_type" AS ENUM('BRIEF', 'CREATIVE_CONCEPT', 'PRODUCTION_PLAN', 'SCRIPT', 'STORYBOARD', 'MODEL_SELECTION', 'COST_ESTIMATE', 'TIMELINE', 'DELIVERY');--> statement-breakpoint
CREATE TABLE "production_document" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"doc_type" "production_doc_type" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_document_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_graph_node" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"agent_run_id" text,
	"node_type" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"input_refs" jsonb DEFAULT '{}'::jsonb,
	"output_asset_ids" jsonb DEFAULT '[]'::jsonb,
	"estimated_cost_usd" real,
	"actual_cost_usd" real,
	"provider_id" text,
	"version_hash" text,
	"requires_approval" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_memory" (
	"project_id" text PRIMARY KEY NOT NULL,
	"identity" jsonb DEFAULT '{}'::jsonb,
	"brand" jsonb DEFAULT '{}'::jsonb,
	"characters" jsonb DEFAULT '[]'::jsonb,
	"visual_style" jsonb DEFAULT '{}'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"user_decisions" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "production_state" "agent_production_state" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "trigger_message" text;--> statement-breakpoint
ALTER TABLE "production_document" ADD CONSTRAINT "production_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_document" ADD CONSTRAINT "production_document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_graph_node" ADD CONSTRAINT "production_graph_node_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_graph_node" ADD CONSTRAINT "production_graph_node_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memory" ADD CONSTRAINT "project_memory_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;