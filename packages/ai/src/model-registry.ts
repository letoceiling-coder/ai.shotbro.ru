export type ModelCapability = "text" | "image" | "video" | "audio" | "embedding";

export type ModelDefinition = {
  id: string;
  provider: string;
  displayName: string;
  capabilities: ModelCapability[];
  /** USD per 1M input tokens (estimate) — Phase 3 billing */
  inputCostPer1M: number;
  outputCostPer1M: number;
  enabled: boolean;
  requiresApproval: boolean;
};

const BUILTIN: ModelDefinition[] = [
  {
    id: "mock/text",
    provider: "mock",
    displayName: "Mock Text (Phase 2)",
    capabilities: ["text"],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    enabled: true,
    requiresApproval: false,
  },
  {
    id: "openrouter/auto",
    provider: "openrouter",
    displayName: "OpenRouter (disabled until Phase 3)",
    capabilities: ["text", "image"],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    enabled: false,
    requiresApproval: true,
  },
];

export class ModelRegistry {
  constructor(private readonly models: ModelDefinition[] = BUILTIN) {}

  list(): ModelDefinition[] {
    return this.models.map((m) => ({ ...m }));
  }

  get(id: string): ModelDefinition | undefined {
    return this.models.find((m) => m.id === id);
  }

  assertEnabled(id: string): ModelDefinition {
    const m = this.get(id);
    if (!m) throw new Error(`Unknown model: ${id}`);
    if (!m.enabled) throw new Error(`Model disabled: ${id}`);
    return m;
  }
}
