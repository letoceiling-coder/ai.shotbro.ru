import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { project } from "./project.js";

export const promptVersion = pgTable("prompt_version", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  version: integer("version").notNull().default(1),
  modelId: text("model_id"),
  renderedPrompt: text("rendered_prompt").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().default({}),
  approvalState: text("approval_state").notNull().default("DRAFT"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
