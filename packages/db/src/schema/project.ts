import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { workspace } from "./workspace.js";

export const projectStatusEnum = pgEnum("project_status", [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
  "DELETED",
]);

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("ACTIVE"),
  mode: text("mode").notNull().default("REAL"),
  demoScenarioId: text("demo_scenario_id"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
