import type { AppEnv } from "@shotbro/config/env";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import { mockLlmComplete } from "./mock-llm-fixtures.js";
import { LlmRequestSchema, type LlmRequest, type LlmResponse, type LlmTransport } from "./types.js";

export type LlmGatewayOptions = {
  transport?: LlmTransport;
  maxRetries?: number;
};

export class LlmGateway {
  private readonly policy: ExecutionPolicyEngine;
  private readonly transport: LlmTransport;

  constructor(
    private readonly env: AppEnv,
    opts: LlmGatewayOptions = {},
  ) {
    this.policy = new ExecutionPolicyEngine(env);
    this.transport = opts.transport ?? { complete: mockLlmComplete };
  }

  async complete(raw: LlmRequest): Promise<LlmResponse> {
    const req = LlmRequestSchema.parse(raw);
    const mode = this.policy.resolveMode();
    this.policy.assertLlmAllowed(mode);

    const retries = 2;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.withTimeout(this.transport.complete({ ...req, executionPolicy: mode }), req.timeoutMs ?? 60_000);
        if (res.error) throw new Error(res.error.message);
        return res;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error("LLM failed");
        if (attempt === retries) break;
      }
    }
    throw lastError ?? new Error("LLM failed");
  }

  /** Live OpenRouter path — blocked until LIVE_APPROVED + real transport wired. */
  async completeViaProvider(req: LlmRequest, liveTransport: LlmTransport): Promise<LlmResponse> {
    const mode = this.policy.resolveMode();
    this.policy.assertProviderNetworkCall(mode);
    this.policy.assertLiveApproved({});
    return liveTransport.complete(req);
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("LLM timeout")), ms)),
    ]);
  }
}
