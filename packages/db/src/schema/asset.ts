import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { project } from "./project.js";
import { workspace } from "./workspace.js";

export const assetStatusEnum = pgEnum("asset_status", [
  "PENDING",
  "UPLOADING",
  "PROCESSING",
  "READY",
  "QUARANTINED",
  "FAILED",
  "DELETED",
]);

export const asset = pgTable("asset", {
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
  category: text("category").notNull().default("upload"),
  mimeType: text("mime_type").notNull(),
  originalName: text("original_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  checksum: text("checksum"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  status: assetStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const assetVersion = pgTable("asset_version", {
  id: text("id").primaryKey(),
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  storageKey: text("storage_key").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assetRelation = pgTable("asset_relation", {
  parentAssetId: text("parent_asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),
  childAssetId: text("child_asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(),
});
