import { z } from "zod";
import { ChatMessageSchema } from "./blocks";
import { GenerationStatusSchema } from "./status";

export const StudioModeSchema = z.enum(["DEMO", "REAL"]);
export type StudioMode = z.infer<typeof StudioModeSchema>;

export const RealProjectListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "DELETED"]),
  mode: z.literal("REAL"),
  updatedAt: z.string(),
  archivedAt: z.string().nullable().optional(),
});

export const PaginatedProjectsSchema = z.object({
  items: z.array(RealProjectListItemSchema),
  nextCursor: z.string().nullable(),
});

export const CreateProjectBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const RealMessageSchema = ChatMessageSchema;
export const PaginatedMessagesSchema = z.object({
  items: z.array(RealMessageSchema),
  nextCursor: z.string().nullable(),
});

export const CreateMessageBodySchema = z.object({
  content: z.string().min(1).max(50000),
  role: z.enum(["user", "system"]).default("user"),
  blocks: z.array(z.record(z.unknown())).optional(),
  attachmentAssetIds: z.array(z.string().uuid()).optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export const UserMeSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  emailVerified: z.boolean(),
  studioMode: StudioModeSchema,
});

export const WorkflowStatusSchema = GenerationStatusSchema;
