import { Injectable } from "@nestjs/common";
import { getAiExecutionConfig } from "@shotbro/config";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { getOpenRouterConfig } from "@shotbro/config/openrouter";
import { AgentOrchestrator, PHASE3_TOOLS } from "@shotbro/ai";

@Injectable()
export class AiService {
  private readonly orchestrator = new AgentOrchestrator(loadEnvFromProcess());

  registrySnapshot() {
    const env = loadEnvFromProcess();
    const openRouter = getOpenRouterConfig(env);
    const execution = getAiExecutionConfig(env);
    return {
      phase: 3,
      execution,
      openRouter: {
        enabled: openRouter.enabled,
        allowPaidRequests: openRouter.allowPaidRequests,
        hasApiKey: openRouter.hasApiKey,
      },
      models: this.orchestrator.models.list(),
      tools: this.orchestrator.tools.list(),
      phase3Tools: PHASE3_TOOLS,
      policy: {
        paidGenerations: execution.mockMode ? "blocked_mock_mode" : "gated",
        requiresApprovalForPaid: true,
      },
    };
  }
}
