import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { conversation } from "./conversation.js";
import { project } from "./project.js";

export const jobStatusEnum = pgEnum("job_status", [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const generationJob = pgTable("generation_job", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  status: jobStatusEnum("status").notNull().default("QUEUED"),
  requestPayload: jsonb("request_payload").$type<Record<string, unknown>>().default({}),
  resultPayload: jsonb("result_payload").$type<Record<string, unknown>>(),
  providerJobId: text("provider_job_id"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
});

export const agentRun = pgTable("agent_run", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").references(() => conversation.id, { onDelete: "set null" }),
  status: jobStatusEnum("status").notNull().default("QUEUED"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const toolExecution = pgTable("tool_execution", {
  id: text("id").primaryKey(),
  agentRunId: text("agent_run_id")
    .notNull()
    .references(() => agentRun.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  status: jobStatusEnum("status").notNull().default("QUEUED"),
  input: jsonb("input").$type<Record<string, unknown>>().default({}),
  output: jsonb("output").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
