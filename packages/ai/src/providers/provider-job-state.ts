export type ProviderJobStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "TIMED_OUT"
  | "NEEDS_RECONCILIATION";

const TRANSITIONS: Record<ProviderJobStatus, ProviderJobStatus[]> = {
  CREATED: ["AUTHORIZED", "FAILED", "CANCELLED"],
  AUTHORIZED: ["SUBMITTING", "FAILED", "CANCELLED"],
  SUBMITTING: ["SUBMITTED", "FAILED", "NEEDS_RECONCILIATION", "TIMED_OUT"],
  SUBMITTED: ["QUEUED", "RUNNING", "FAILED", "NEEDS_RECONCILIATION"],
  QUEUED: ["RUNNING", "FAILED", "CANCEL_REQUESTED", "CANCELLED"],
  RUNNING: ["COMPLETED", "FAILED", "CANCEL_REQUESTED", "TIMED_OUT", "NEEDS_RECONCILIATION"],
  COMPLETED: [],
  FAILED: [],
  CANCEL_REQUESTED: ["CANCELLED", "RUNNING", "NEEDS_RECONCILIATION"],
  CANCELLED: [],
  TIMED_OUT: ["NEEDS_RECONCILIATION", "FAILED"],
  NEEDS_RECONCILIATION: ["RUNNING", "FAILED", "COMPLETED", "CANCELLED"],
};

export function assertProviderJobTransition(from: ProviderJobStatus, to: ProviderJobStatus): void {
  if (from === to) return;
  const allowed = TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new Error(`Invalid provider job transition ${from} → ${to}`);
  }
}

export function isTerminalProviderJobStatus(status: ProviderJobStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
}
