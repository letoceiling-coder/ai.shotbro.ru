import type { CapabilityEntry } from "../capability-matrix.js";
import { findCapability } from "../capability-matrix.js";
import type { RouteCandidate } from "./types.js";

export type ProviderRouteCostEstimate = {
  amountUsd: number | null;
  priceStatus: "KNOWN" | "UNKNOWN";
  billingUnit: "request" | "second" | "character";
};

/** Never treat UNKNOWN as zero — mock estimates use null until verified. */
export function estimateCandidateCost(
  candidate: Pick<RouteCandidate, "providerId" | "modelId" | "operation" | "priceStatus" | "estimatedUsd">,
  cap?: CapabilityEntry,
): ProviderRouteCostEstimate {
  const entry = cap ?? findCapability(candidate.providerId, candidate.modelId, candidate.operation);
  if (candidate.estimatedUsd != null && candidate.priceStatus === "KNOWN") {
    return { amountUsd: candidate.estimatedUsd, priceStatus: "KNOWN", billingUnit: "request" };
  }
  if (entry?.priceStatus === "KNOWN" && candidate.estimatedUsd != null) {
    return { amountUsd: candidate.estimatedUsd, priceStatus: "KNOWN", billingUnit: "request" };
  }
  return { amountUsd: null, priceStatus: entry?.priceStatus ?? candidate.priceStatus ?? "UNKNOWN", billingUnit: "request" };
}
