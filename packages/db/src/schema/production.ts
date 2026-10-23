import { integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { agentRun } from "./jobs.js";
import { project } from "./project.js";
import { productionDocTypeEnum } from "./production-enums.js";

export { agentProductionStateEnum, productionDocTypeEnum } from "./production-enums.js";

export const productionDocument = pgTable("production_document", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  docType: productionDocTypeEnum("doc_type").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("ACTIVE"),
  schemaVersion: integer("schema_version").notNull().default(1),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  parentDocumentId: text("parent_document_id"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectMemory = pgTable("project_memory", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => project.id, { onDelete: "cascade" }),
  identity: jsonb("identity").$type<Record<string, unknown>>().default({}),
  brand: jsonb("brand").$type<Record<string, unknown>>().default({}),
  characters: jsonb("characters").$type<unknown[]>().default([]),
  visualStyle: jsonb("visual_style").$type<Record<string, unknown>>().default({}),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}),
  userDecisions: jsonb("user_decisions").$type<unknown[]>().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productionGraphNode = pgTable("production_graph_node", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  agentRunId: text("agent_run_id").references(() => agentRun.id, { onDelete: "cascade" }),
  nodeType: text("node_type").notNull(),
  status: text("status").notNull().default("QUEUED"),
  dependencies: jsonb("dependencies").$type<string[]>().default([]),
  inputRefs: jsonb("input_refs").$type<Record<string, unknown>>().default({}),
  outputAssetIds: jsonb("output_asset_ids").$type<string[]>().default([]),
  estimatedCostUsd: real("estimated_cost_usd"),
  actualCostUsd: real("actual_cost_usd"),
  providerId: text("provider_id"),
  versionHash: text("version_hash"),
  requiresApproval: integer("requires_approval").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
