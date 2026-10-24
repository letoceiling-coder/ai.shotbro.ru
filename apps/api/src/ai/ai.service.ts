import { Injectable } from "@nestjs/common";
import { getAiExecutionConfig } from "@shotbro/config";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { getOpenRouterConfig } from "@shotbro/config/openrouter";
import { AgentOrchestrator, ExecutionPolicyEngine, PHASE3_TOOLS, PHASE4_TOOLS, ProviderRegistry } from "@shotbro/ai";

@Injectable()
export class AiService {
  private readonly orchestrator = new AgentOrchestrator(loadEnvFromProcess());

  registrySnapshot() {
    const env = loadEnvFromProcess();
    const openRouter = getOpenRouterConfig(env);
    const execution = getAiExecutionConfig(env);
    const policyEngine = new ExecutionPolicyEngine(env);
    const providers = ProviderRegistry.withDefaults();
    return {
      phase: 4,
      executionMode: policyEngine.resolveMode(),
      execution,
      openRouter: {
        enabled: openRouter.enabled,
        allowPaidRequests: openRouter.allowPaidRequests,
        hasApiKey: openRouter.hasApiKey,
      },
      models: this.orchestrator.models.list(),
      tools: this.orchestrator.tools.list(),
      phase3Tools: PHASE3_TOOLS,
      phase4Tools: PHASE4_TOOLS,
      providers: providers.list().map((p) => ({ id: p.id, kind: p.kind, enabled: p.enabled })),
      policy: {
        paidGenerations: execution.mockMode ? "blocked_mock_mode" : "gated",
        requiresApprovalForPaid: true,
        liveProviderNetwork: policyEngine.resolveMode() === "LIVE_APPROVED" ? "allowed" : "blocked",
      },
    };
  }

  listModels() {
    return { items: this.orchestrator.models.list(), mock: true };
  }

  listProviders() {
    return { items: ProviderRegistry.withDefaults().list().map((p) => p.id), mock: true };
  }

  listTools() {
    return { items: PHASE4_TOOLS.map((t) => ({ id: t.id, status: t.implementationStatus, enabled: t.enabled })) };
  }
}
