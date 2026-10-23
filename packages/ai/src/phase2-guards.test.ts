import { describe, expect, it } from "vitest";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { AgentOrchestrator } from "./orchestrator.js";
import { OpenRouterProviderAdapter } from "./providers/openrouter-provider.js";

function minimalEnv(overrides: Record<string, string> = {}) {
  return {
    S3_ENDPOINT: "https://example.invalid",
    S3_REGION: "ru-3",
    S3_BUCKET: "b",
    S3_ACCESS_KEY_ID: "12345678901234567890",
    S3_SECRET_ACCESS_KEY: "12345678901234567890",
    OPENROUTER_ENABLED: "false",
    EMAIL_ENABLED: "false",
    ...overrides,
  };
}

describe("@shotbro/ai Phase 2 guards", () => {
  it("mock orchestrator runs without cost", async () => {
    const env = loadEnvFromProcess(minimalEnv());
    const orch = new AgentOrchestrator(env);
    const out = await orch.runMockTurn("mock/text", "hello");
    expect(out.provider).toBe("mock");
    expect(out.content).toContain("hello");
  });

  it("openrouter adapter refuses when disabled", async () => {
    const env = loadEnvFromProcess(minimalEnv());
    const adapter = new OpenRouterProviderAdapter(env);
    await expect(adapter.complete({ modelId: "x", messages: [] })).rejects.toThrow(/disabled/i);
  });

  it("disabled generative tools throw", () => {
    const env = loadEnvFromProcess(minimalEnv());
    const orch = new AgentOrchestrator(env);
    expect(() => orch.plan("mock/text", ["generate.image"])).toThrow(/disabled/i);
  });
});
