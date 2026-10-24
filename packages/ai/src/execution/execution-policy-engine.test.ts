import { describe, expect, it } from "vitest";
import { ExecutionPolicyEngine } from "./execution-policy-engine.js";

const mockEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
} as import("@shotbro/config/env").AppEnv;

describe("ExecutionPolicyEngine", () => {
  it("resolves MOCK_ONLY in Phase 4 default env", () => {
    expect(new ExecutionPolicyEngine(mockEnv).resolveMode()).toBe("MOCK_ONLY");
  });

  it("blocks provider network calls", () => {
    expect(() => new ExecutionPolicyEngine(mockEnv).assertProviderNetworkCall()).toThrow(/blocked/i);
  });
});
