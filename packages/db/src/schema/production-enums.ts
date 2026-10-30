import { pgEnum } from "drizzle-orm/pg-core";

export const agentProductionStateEnum = pgEnum("agent_production_state", [
  "DRAFT",
  "BRIEFING",
  "PLANNING",
  "WAITING_PLAN_APPROVAL",
  "SCRIPTING",
  "WAITING_SCRIPT_APPROVAL",
  "STORYBOARDING",
  "WAITING_STORYBOARD_APPROVAL",
  "READY_FOR_PRODUCTION",
  "WAITING_COST_APPROVAL",
  "WAITING_PRODUCTION_APPROVAL",
  "QUEUED",
  "PRODUCING",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "PAUSED",
  "FAILED",
  "CANCELLED",
  "NEEDS_REVISION",
  "BLOCKED_PROVIDER",
  "BLOCKED_BUDGET",
]);

export const productionDocTypeEnum = pgEnum("production_doc_type", [
  "BRIEF",
  "CREATIVE_CONCEPT",
  "PRODUCTION_PLAN",
  "SCRIPT",
  "STORYBOARD",
  "MODEL_SELECTION",
  "COST_ESTIMATE",
  "TIMELINE",
  "DELIVERY",
  "SCENE_CANVAS",
]);
