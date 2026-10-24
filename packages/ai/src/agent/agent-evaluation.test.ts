import { describe, expect, it } from "vitest";
import { LlmGateway } from "../llm/llm-gateway.js";
import { AGENT_EVALUATION_SCENARIOS } from "./agent-evaluation.fixtures.js";

const mockEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
} as import("@shotbro/config/env").AppEnv;

describe("Phase 4 agent evaluation (mock LLM)", () => {
  const gateway = new LlmGateway(mockEnv);

  for (const scenario of AGENT_EVALUATION_SCENARIOS) {
    it(`scenario ${scenario.id}: ${scenario.name}`, async () => {
      const res = await gateway.complete({
        requestId: `eval-${scenario.id}`,
        modelId: "mock/text-std",
        messages: [{ role: "user", content: scenario.prompt }],
        executionPolicy: "MOCK_ONLY",
      });
      expect(res.mock).toBe(true);
      if (scenario.id === 12) {
        expect(res.message?.toLowerCase()).toMatch(/injection|политик|безопас/i);
      } else {
        expect(res.message || res.toolCalls?.length || res.structured).toBeTruthy();
      }
    });
  }
});
