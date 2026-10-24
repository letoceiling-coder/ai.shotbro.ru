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

  it("blocks network when credentials would exist but LIVE is disabled", () => {
    const env = {
      AI_MOCK_MODE: false,
      PROVIDER_LIVE_EXECUTION_ENABLED: false,
      OPENROUTER_ALLOW_PAID_REQUESTS: false,
    } as import("@shotbro/config/env").AppEnv;
    expect(new ExecutionPolicyEngine(env).resolveMode()).toBe("LIVE_CONFIGURED_DISABLED");
    expect(() => new ExecutionPolicyEngine(env).assertProviderNetworkCall()).toThrow(/blocked/i);
  });

  it("blocks LIVE_APPROVED without production approval context", () => {
    const env = {
      AI_MOCK_MODE: false,
      PROVIDER_LIVE_EXECUTION_ENABLED: true,
      OPENROUTER_ALLOW_PAID_REQUESTS: false,
    } as import("@shotbro/config/env").AppEnv;
    expect(new ExecutionPolicyEngine(env).resolveMode()).toBe("LIVE_APPROVED");
    expect(() =>
      new ExecutionPolicyEngine(env).assertLiveApproved({ userId: "u1", projectId: "p1" }),
    ).toThrow(/approval|cost/i);
  });
});
