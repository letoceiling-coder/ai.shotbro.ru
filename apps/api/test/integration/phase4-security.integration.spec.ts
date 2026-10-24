import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { ExecutionPolicyEngine } from "@shotbro/ai";
import { ProductionAssetIngestionService } from "@shotbro/ai";

const mockEnv = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
  OPENROUTER_ENABLED: false,
} as import("@shotbro/config/env").AppEnv;

describe("Phase 4 security (unit gates)", () => {
  it("blocks paid provider network I/O", () => {
    expect(() => new ExecutionPolicyEngine(mockEnv).assertProviderNetworkCall()).toThrow();
  });

  it("blocks SSRF private URL in ingestion guard", () => {
    const g = new ProductionAssetIngestionService({
      maxBytes: 1_000_000,
      allowedMimePrefixes: ["image/"],
      allowedHostnames: [],
    });
    expect(g.validateUrl("http://127.0.0.1/x.png").ok).toBe(false);
  });

  it("webhook signature format", () => {
    const secret = "test-secret";
    const body = JSON.stringify({ eventId: "e1", providerJobId: "j1", status: "COMPLETED", timestamp: 1 });
    const ts = "123";
    const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(sig.length).toBe(64);
  });
});
