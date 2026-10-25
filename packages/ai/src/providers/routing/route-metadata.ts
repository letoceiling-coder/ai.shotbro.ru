import { z } from "zod";

export const ProviderJobRouteMetadataSchema = z.object({
  requestedProvider: z.string(),
  requestedModel: z.string(),
  selectedProvider: z.string(),
  selectedModel: z.string(),
  operation: z.string(),
  fallbackReason: z.string().optional(),
  fallbackAttempt: z.number().int().nonnegative().default(0),
  originalSettingsSnapshot: z.record(z.unknown()).optional(),
  translatedSettingsSnapshot: z.record(z.unknown()).optional(),
  approvedBudgetUsd: z.number().optional(),
  estimatedCostUsd: z.number().nullable().optional(),
  reservedBudgetUsd: z.number().optional(),
  consumedBudgetUsd: z.number().optional(),
  actualUsage: z.record(z.unknown()).optional(),
  reconciliationStatus: z
    .enum(["NONE", "NEEDS_RECONCILIATION", "RECONCILED", "BLOCKED"])
    .default("NONE"),
  routePlanVersion: z.number().int().positive().default(1),
  planStatus: z.string().optional(),
  parameterWarnings: z.array(z.string()).optional(),
  duplicateJobPrevented: z.boolean().optional(),
});

export type ProviderJobRouteMetadata = z.infer<typeof ProviderJobRouteMetadataSchema>;

export function mergeRouteMetadata(
  base: Record<string, unknown> | undefined,
  route: ProviderJobRouteMetadata,
): Record<string, unknown> {
  return { ...(base ?? {}), route: ProviderJobRouteMetadataSchema.parse(route) };
}
