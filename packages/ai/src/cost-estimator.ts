import type { ModelDefinition } from "./model-registry.js";

export type CostEstimateInput = {
  model: ModelDefinition;
  inputTokens: number;
  outputTokens: number;
};

export type CostEstimate = {
  usd: number;
  requiresApproval: boolean;
  breakdown: { inputUsd: number; outputUsd: number };
};

export function estimateCost(input: CostEstimateInput): CostEstimate {
  const inputUsd = (input.inputTokens / 1_000_000) * input.model.inputCostPer1M;
  const outputUsd = (input.outputTokens / 1_000_000) * input.model.outputCostPer1M;
  const usd = inputUsd + outputUsd;
  return {
    usd,
    requiresApproval: input.model.requiresApproval || usd > 0,
    breakdown: { inputUsd, outputUsd },
  };
}

/** Phase 2 — any paid estimate must be rejected server-side */
export function assertPhase2CostAllowed(estimate: CostEstimate): void {
  if (estimate.usd > 0) {
    throw new Error("Paid operations require owner approval (Phase 3)");
  }
}
