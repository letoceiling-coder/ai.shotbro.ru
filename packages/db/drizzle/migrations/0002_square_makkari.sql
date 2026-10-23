CREATE TYPE "public"."budget_reservation_status" AS ENUM('HELD', 'RELEASED', 'CAPTURED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "budget_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"agent_run_id" text,
	"idempotency_key" text NOT NULL,
	"amount_usd" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "budget_reservation_status" DEFAULT 'HELD' NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "budget_reservation_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "cost_ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"agent_run_id" text,
	"reservation_id" text,
	"entry_type" text NOT NULL,
	"amount_usd" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source" text NOT NULL,
	"mock" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_version" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"model_id" text,
	"rendered_prompt" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb,
	"approval_state" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_execution" ADD COLUMN "side_effect" text DEFAULT 'READ_ONLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_execution" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "tool_execution" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "tool_execution" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "budget_reservation" ADD CONSTRAINT "budget_reservation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_reservation" ADD CONSTRAINT "budget_reservation_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_reservation" ADD CONSTRAINT "budget_reservation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_ledger_entry" ADD CONSTRAINT "cost_ledger_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_ledger_entry" ADD CONSTRAINT "cost_ledger_entry_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_ledger_entry" ADD CONSTRAINT "cost_ledger_entry_reservation_id_budget_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."budget_reservation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_version" ADD CONSTRAINT "prompt_version_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_version" ADD CONSTRAINT "prompt_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;