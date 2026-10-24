export type ModelStrategy = "economy" | "balance" | "quality" | "manual";

export type RoutedModel = {
  modelId: string;
  provider: string;
  operation?: string;
  priceStatus: "KNOWN" | "UNKNOWN";
  mock: boolean;
  rationale: string;
};

export function routeModel(task: "text" | "image" | "video" | "audio", strategy: ModelStrategy): RoutedModel {
  const suffix = strategy === "economy" ? "lite" : strategy === "quality" ? "pro" : "std";
  return {
    modelId: `mock/${task}-${suffix}`,
    provider: "mock",
    priceStatus: "KNOWN",
    mock: true,
    rationale: `Mock ${strategy} route for ${task}`,
  };
}

export type RouteModelInput = {
  task: "text" | "image" | "video" | "audio";
  operation: string;
  strategy: ModelStrategy;
  budgetUsd?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  requiresReferences?: boolean;
};

export function selectModel(input: RouteModelInput): RoutedModel {
  const base = routeModel(input.task, input.strategy);
  if (input.budgetUsd != null && input.budgetUsd < 2 && input.strategy !== "manual") {
    return routeModel(input.task, "economy");
  }
  if (input.requiresReferences && input.task === "video") {
    return { ...base, operation: "REFERENCE_VIDEO", rationale: "Reference-capable mock video route" };
  }
  return { ...base, operation: input.operation };
}
