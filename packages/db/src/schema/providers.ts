import { integer, jsonb, numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agentRun } from "./jobs.js";
import { project } from "./project.js";

export const providerJobStatusEnum = pgEnum("provider_job_status", [
  "CREATED",
  "AUTHORIZED",
  "SUBMITTING",
  "SUBMITTED",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "TIMED_OUT",
  "NEEDS_RECONCILIATION",
]);

export const providerJob = pgTable("provider_job", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => agentRun.id, { onDelete: "set null" }),
  sceneId: text("scene_id"),
  graphNodeId: text("graph_node_id"),
  providerId: text("provider_id").notNull(),
  modelId: text("model_id").notNull(),
  operation: text("operation").notNull(),
  status: providerJobStatusEnum("status").notNull().default("CREATED"),
  providerJobId: text("provider_job_id"),
  inputHash: text("input_hash"),
  idempotencyKey: text("idempotency_key").unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  version: integer("version").notNull().default(1),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  outputAssetIds: jsonb("output_asset_ids").$type<string[]>().default([]),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 4 }),
  actualUsage: jsonb("actual_usage").$type<Record<string, unknown>>(),
  failureCode: text("failure_code"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerJobEvent = pgTable("provider_job_event", {
  id: text("id").primaryKey(),
  providerJobId: text("provider_job_id")
    .notNull()
    .references(() => providerJob.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerExecutionAttempt = pgTable("provider_execution_attempt", {
  id: text("id").primaryKey(),
  providerJobId: text("provider_job_id")
    .notNull()
    .references(() => providerJob.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  status: text("status").notNull(),
  requestPayload: jsonb("request_payload").$type<Record<string, unknown>>(),
  responsePayload: jsonb("response_payload").$type<Record<string, unknown>>(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
