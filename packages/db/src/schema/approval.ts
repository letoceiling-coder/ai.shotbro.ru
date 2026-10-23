import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { project } from "./project.js";

export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REQUIRES_REVISION",
  "EXPIRED",
]);

export const approval = pgTable("approval", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  targetVersion: text("target_version").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: approvalStatusEnum("status").notNull().default("PENDING"),
  requestedBy: text("requested_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
