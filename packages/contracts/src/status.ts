import { z } from "zod";

export const GenerationStatusSchema = z.enum([
  "DRAFT",
  "ANALYZING",
  "PLANNING",
  "AWAITING_APPROVAL",
  "QUEUED",
  "RUNNING",
  "VALIDATING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "NEEDS_REVISION",
]);

export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const PlanStepStatusSchema = z.enum([
  "completed",
  "active",
  "pending",
  "failed",
  "canceled",
]);

export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;

export const QualityStrategySchema = z.enum(["economy", "balance", "quality"]);

export type QualityStrategy = z.infer<typeof QualityStrategySchema>;
