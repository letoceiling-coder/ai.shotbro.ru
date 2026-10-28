import { describe, expect, it } from "vitest";
import {
  isProductionBootstrapUserMessage,
  planCreativeIntent,
  shouldUseMockCreativePlanner,
} from "../src/agent/creative-intent-planner.js";
import { resolveStudioMessageIntent } from "../src/agent/studio-intent.js";
import { CreativeAgentRuntime } from "../src/agent/creative-agent-runtime.js";

const PRODUCTION_PROMPT =
  "Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo";

describe("agent message routing (5K + production isolation)", () => {
  it("detects production bootstrap NL", () => {
    expect(isProductionBootstrapUserMessage(PRODUCTION_PROMPT)).toBe(true);
    expect(isProductionBootstrapUserMessage("phase5k найди фото")).toBe(false);
    expect(isProductionBootstrapUserMessage("Измени второй кадр сцены")).toBe(false);
    expect(resolveStudioMessageIntent(PRODUCTION_PROMPT)).toBe("production_bootstrap");
    expect(resolveStudioMessageIntent("phase5k: библиотека")).toBe("creative_nl");
  });

  it("mock planner returns null for production bootstrap", () => {
    expect(planCreativeIntent(PRODUCTION_PROMPT)).toBeNull();
    expect(planCreativeIntent("phase5k: библиотека")).not.toBeNull();
  });

  it("creative runtime returns no_intent for production bootstrap before live LLM loop", async () => {
    const env = {
      LLM_LIVE_EXECUTION_ENABLED: "true",
      OPENROUTER_ENABLED: "true",
      OPENROUTER_API_KEY: "test-key",
      CREATIVE_AGENT_MOCK_PLANNER: "0",
    } as Parameters<typeof shouldUseMockCreativePlanner>[0];

    const runtime = new CreativeAgentRuntime(env);
    const turn = await runtime.runCreativeTurn({
      runId: "run-test",
      projectId: "proj-test",
      userId: "user-test",
      userMessage: PRODUCTION_PROMPT,
      storage: {} as never,
    });
    expect(turn.status).toBe("no_intent");
    expect(turn.results).toEqual([]);
  });
});
