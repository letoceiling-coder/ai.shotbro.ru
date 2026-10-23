export type ModelStrategy = "economy" | "balance" | "quality" | "manual";

export type RoutedModel = {
  modelId: string;
  provider: "mock";
  priceStatus: "KNOWN" | "UNKNOWN";
  mock: true;
};

export function routeModel(task: "text" | "image" | "video" | "audio", strategy: ModelStrategy): RoutedModel {
  const suffix = strategy === "economy" ? "lite" : strategy === "quality" ? "pro" : "std";
  return {
    modelId: `mock/${task}-${suffix}`,
    provider: "mock",
    priceStatus: "KNOWN",
    mock: true,
  };
}
