import { Injectable } from "@nestjs/common";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { getOpenRouterConfig } from "@shotbro/config/openrouter";
import { AgentOrchestrator } from "@shotbro/ai";

@Injectable()
export class AiService {
  private readonly orchestrator = new AgentOrchestrator(loadEnvFromProcess());

  registrySnapshot() {
    const openRouter = getOpenRouterConfig(loadEnvFromProcess());
    return {
      phase: 2,
      openRouter: {
        enabled: openRouter.enabled,
        allowPaidRequests: openRouter.allowPaidRequests,
        hasApiKey: openRouter.hasApiKey,
      },
      models: this.orchestrator.models.list(),
      tools: this.orchestrator.tools.list(),
      policy: {
        paidGenerations: "blocked",
        requiresApprovalForPaid: true,
      },
    };
  }
}
