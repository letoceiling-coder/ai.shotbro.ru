import type { AppEnv } from "@shotbro/config/env";
import { getOpenRouterConfig } from "@shotbro/config/openrouter";
import { assertPhase2CostAllowed, estimateCost } from "./cost-estimator.js";
import { ModelRegistry } from "./model-registry.js";
import { MockProviderAdapter } from "./providers/mock-provider.js";
import { OpenRouterProviderAdapter } from "./providers/openrouter-provider.js";
import type { ProviderAdapter } from "./providers/types.js";
import { ToolRegistry } from "./tool-registry.js";

export type OrchestratorPlan = {
  modelId: string;
  toolIds: string[];
  estimatedUsd: number;
  requiresApproval: boolean;
};

export class AgentOrchestrator {
  readonly models = new ModelRegistry();
  readonly tools = new ToolRegistry();
  private readonly providers: ProviderAdapter[];

  constructor(private readonly env: AppEnv) {
    this.providers = [new MockProviderAdapter(), new OpenRouterProviderAdapter(env)];
  }

  plan(modelId: string, toolIds: string[]): OrchestratorPlan {
    const model = this.models.assertEnabled(modelId);
    for (const id of toolIds) this.tools.assertRunnable(id);
    const estimate = estimateCost({ model, inputTokens: 512, outputTokens: 256 });
    assertPhase2CostAllowed(estimate);
    return {
      modelId,
      toolIds,
      estimatedUsd: estimate.usd,
      requiresApproval: estimate.requiresApproval,
    };
  }

  /** Mock-only execution path for Phase 2 integration tests */
  async runMockTurn(modelId: string, userText: string) {
    const model = this.models.assertEnabled(modelId);
    if (model.provider !== "mock") {
      throw new Error("Only mock provider runs in Phase 2");
    }
    const orCfg = getOpenRouterConfig(this.env);
    if (orCfg.enabled) throw new Error("OpenRouter must stay disabled in Phase 2");
    const provider = this.providers.find((p) => p.id === "mock")!;
    return provider.complete({
      modelId,
      messages: [{ role: "user", content: userText }],
    });
  }
}
