import { jsonb, pgEnum, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { agentRun } from "./jobs.js";
import { project } from "./project.js";

export const budgetReservationStatusEnum = pgEnum("budget_reservation_status", [
  "HELD",
  "RELEASED",
  "CAPTURED",
  "EXPIRED",
]);

export const budgetReservation = pgTable("budget_reservation", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  agentRunId: text("agent_run_id").references(() => agentRun.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  amountUsd: real("amount_usd").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: budgetReservationStatusEnum("status").notNull().default("HELD"),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const costLedgerEntry = pgTable("cost_ledger_entry", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  agentRunId: text("agent_run_id").references(() => agentRun.id, { onDelete: "set null" }),
  reservationId: text("reservation_id").references(() => budgetReservation.id, { onDelete: "set null" }),
  entryType: text("entry_type").notNull(),
  amountUsd: real("amount_usd").notNull(),
  currency: text("currency").notNull().default("USD"),
  source: text("source").notNull(),
  mock: integer("mock").notNull().default(1),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
