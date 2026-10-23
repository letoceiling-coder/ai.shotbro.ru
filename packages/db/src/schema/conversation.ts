import { integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { asset } from "./asset.js";
import { project } from "./project.js";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system", "tool"]);

export const conversation = pgTable("conversation", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const message = pgTable("message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("sent"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const messageBlock = pgTable("message_block", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => message.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  position: integer("position").notNull().default(0),
});

export const messageAttachment = pgTable("message_attachment", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => message.id, { onDelete: "cascade" }),
  assetId: text("asset_id")
    .notNull()
    .references(() => asset.id, { onDelete: "restrict" }),
  position: integer("position").notNull().default(0),
});
