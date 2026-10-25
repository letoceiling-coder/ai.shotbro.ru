import type { AppEnv } from "@shotbro/config/env";
import { isProviderLiveEligible } from "@shotbro/config/provider-policy";
import type { CanonicalSceneSettings, ProviderRoutePlan } from "./types.js";
import { estimateCandidateCost } from "./cost-estimator.js";

export type BudgetGuardInput = {
  settings: CanonicalSceneSettings;
  plan: ProviderRoutePlan;
  env: AppEnv;
  /** Explicit fallback estimate for tests / verified pricing tables. */
  fallbackEstimateUsd?: number;
};

export function applyBudgetGuard(input: BudgetGuardInput): ProviderRoutePlan {
  const { plan, settings, env } = input;
  const events = [...plan.events];
  const selected = plan.selected;
  if (!selected) return plan;

  const estimate =
    selected === plan.fallbacks[0] && input.fallbackEstimateUsd != null
      ? { amountUsd: input.fallbackEstimateUsd, priceStatus: "UNKNOWN" as const, billingUnit: "request" as const }
      : estimateCandidateCost(selected);

  if (estimate.priceStatus === "UNKNOWN" && isProviderLiveEligible(env, selected.providerId as never)) {
    return {
      ...plan,
      status: "PRICE_UNVERIFIED",
      events: [...events, { type: "provider.pricing.unknown", message: "Price unverified — live blocked" }],
    };
  }

  const approved = settings.approvedMaxCostUsd ?? 0;
  const consumed = settings.consumedBudgetUsd ?? 0;
  const reserved = settings.reservedBudgetUsd ?? 0;
  const nextCost = estimate.amountUsd ?? 0;
  const remaining = approved > 0 ? approved - consumed - reserved : approved;

  if (plan.status === "FALLBACK_PLANNED" && approved > 0 && nextCost > remaining) {
    return {
      ...plan,
      status: "RE_APPROVAL_REQUIRED",
      events: [...events, { type: "provider.fallback.approval", message: "Fallback exceeds approved budget" }],
    };
  }

  return {
    ...plan,
    translatedSettingsSnapshot: plan.translatedSettingsSnapshot,
  };
}
