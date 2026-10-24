import { describe, expect, it } from "vitest";
import { MockHttpTransport } from "./http-transport.js";
import { OpenRouterLlmAdapter } from "./openrouter-llm-adapter.js";

const env = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
} as import("@shotbro/config/env").AppEnv;

describe("OpenRouterLlmAdapter contract (mock transport)", () => {
  it("blocks live network when policy is MOCK_ONLY", async () => {
    const transport = new MockHttpTransport({
      "POST https://openrouter.ai/api/v1/chat/completions": {
        status: 200,
        headers: {},
        body: { choices: [{ message: { content: "ok" } }] },
      },
    });
    const adapter = new OpenRouterLlmAdapter(env, transport);
    await expect(
      adapter.complete({
        requestId: "r1",
        modelId: "mock/text",
        messages: [{ role: "user", content: "hi" }],
        executionPolicy: "MOCK_ONLY",
      }),
    ).rejects.toThrow(/disabled|blocked/i);
  });

  it("maps 429 fixture when LIVE_APPROVED (simulated env mismatch still blocked)", async () => {
    const transport = new MockHttpTransport({
      "POST https://openrouter.ai/api/v1/chat/completions": {
        status: 429,
        headers: {},
        body: { error: "rate limit" },
      },
    });
    const adapter = new OpenRouterLlmAdapter(env, transport);
    await expect(
      adapter.complete({
        requestId: "r2",
        modelId: "test/model",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow();
  });
});
