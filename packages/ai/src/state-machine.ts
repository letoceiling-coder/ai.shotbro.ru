import type { AgentProductionState } from "@shotbro/contracts";

const TERMINAL: AgentProductionState[] = ["COMPLETED", "CANCELLED", "FAILED"];

const TRANSITIONS: Record<AgentProductionState, AgentProductionState[]> = {
  DRAFT: ["BRIEFING", "CANCELLED"],
  BRIEFING: ["PLANNING", "FAILED", "CANCELLED"],
  PLANNING: ["WAITING_PLAN_APPROVAL", "FAILED", "CANCELLED"],
  WAITING_PLAN_APPROVAL: ["SCRIPTING", "NEEDS_REVISION", "CANCELLED", "PAUSED"],
  SCRIPTING: ["WAITING_SCRIPT_APPROVAL", "FAILED", "CANCELLED"],
  WAITING_SCRIPT_APPROVAL: ["STORYBOARDING", "NEEDS_REVISION", "CANCELLED", "PAUSED"],
  STORYBOARDING: ["WAITING_STORYBOARD_APPROVAL", "FAILED", "CANCELLED"],
  WAITING_STORYBOARD_APPROVAL: ["READY_FOR_PRODUCTION", "NEEDS_REVISION", "CANCELLED", "PAUSED"],
  READY_FOR_PRODUCTION: ["WAITING_COST_APPROVAL", "BLOCKED_BUDGET", "CANCELLED"],
  WAITING_COST_APPROVAL: ["WAITING_PRODUCTION_APPROVAL", "NEEDS_REVISION", "BLOCKED_BUDGET", "CANCELLED", "PAUSED"],
  WAITING_PRODUCTION_APPROVAL: ["QUEUED", "NEEDS_REVISION", "CANCELLED", "PAUSED"],
  QUEUED: ["PRODUCING", "CANCELLED", "PAUSED"],
  PRODUCING: ["QUALITY_CHECK", "FAILED", "BLOCKED_PROVIDER", "CANCELLED", "PAUSED"],
  QUALITY_CHECK: ["READY_FOR_DELIVERY", "NEEDS_REVISION", "FAILED"],
  READY_FOR_DELIVERY: ["COMPLETED", "NEEDS_REVISION"],
  COMPLETED: [],
  PAUSED: ["BRIEFING", "PLANNING", "SCRIPTING", "STORYBOARDING", "QUEUED", "PRODUCING", "CANCELLED"],
  FAILED: ["BRIEFING", "PLANNING", "SCRIPTING", "CANCELLED"],
  CANCELLED: [],
  NEEDS_REVISION: ["BRIEFING", "PLANNING", "SCRIPTING", "STORYBOARDING", "CANCELLED"],
  BLOCKED_PROVIDER: ["PRODUCING", "CANCELLED", "PAUSED"],
  BLOCKED_BUDGET: ["WAITING_COST_APPROVAL", "CANCELLED"],
};

export function assertProductionTransition(from: AgentProductionState, to: AgentProductionState): void {
  if (from === to) return;
  if (TERMINAL.includes(from)) {
    throw new Error(`Production state ${from} is terminal`);
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid production transition: ${from} → ${to}`);
  }
}

export function canTransition(from: AgentProductionState, to: AgentProductionState): boolean {
  try {
    assertProductionTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

/** Production cannot start without passing cost approval gate. */
export function assertProducingAllowed(
  state: AgentProductionState,
  flags: { planApproved: boolean; scriptApproved: boolean; storyboardApproved: boolean; costApproved: boolean },
): void {
  if (state !== "PRODUCING" && state !== "QUEUED") return;
  if (!flags.planApproved || !flags.scriptApproved || !flags.storyboardApproved) {
    throw new Error("Missing creative approvals before production");
  }
  if (!flags.costApproved) {
    throw new Error("Cost approval required before PRODUCING");
  }
}
