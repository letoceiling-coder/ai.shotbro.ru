import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { project } from "./project.js";
import { workspace } from "./workspace.js";

export const uploadSessionStatusEnum = pgEnum("upload_session_status", [
  "INIT",
  "UPLOADING",
  "COMPLETED",
  "ABORTED",
  "EXPIRED",
  "FAILED",
]);

export const uploadSession = pgTable("upload_session", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  assetId: text("asset_id"),
  storageKey: text("storage_key").notNull(),
  expectedMime: text("expected_mime").notNull(),
  maxSizeBytes: bigint("max_size_bytes", { mode: "number" }).notNull(),
  multipartUploadId: text("multipart_upload_id"),
  status: uploadSessionStatusEnum("status").notNull().default("INIT"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvent = pgTable("audit_event", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "set null" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outboxEvent = pgTable("outbox_event", {
  id: text("id").primaryKey(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const eventLog = pgTable("event_log", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
  resourceId: text("resource_id"),
  type: text("type").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const idempotencyRecord = pgTable("idempotency_record", {
  key: text("key").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  route: text("route").notNull(),
  responseHash: text("response_hash"),
  responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
