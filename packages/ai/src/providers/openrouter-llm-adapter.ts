import { assertOpenRouterRequestsAllowed, getOpenRouterConfig } from "@shotbro/config/openrouter";
import type { AppEnv } from "@shotbro/config/env";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type { LlmRequest, LlmResponse } from "../llm/types.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";

/** Maps internal LLM requests to OpenRouter chat/completions (network only when policy allows). */
export class OpenRouterLlmAdapter {
  readonly id = "openrouter";
  private readonly policy: ExecutionPolicyEngine;

  constructor(
    private readonly env: AppEnv,
    private readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const cfg = getOpenRouterConfig(this.env);
    assertOpenRouterRequestsAllowed(cfg);
    this.policy.assertProviderNetworkCall();

    const body = {
      model: req.modelId,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature,
      max_tokens: req.maxOutputTokens,
    };

    const res = await this.http.request({
      method: "POST",
      url: `${cfg.baseUrl}/chat/completions`,
      headers: {
        Authorization: cfg.hasApiKey && this.env.OPENROUTER_API_KEY ? `Bearer ${this.env.OPENROUTER_API_KEY}` : "",
        "Content-Type": "application/json",
      },
      body,
      timeoutMs: req.timeoutMs ?? 60_000,
    });

    if (res.status >= 400) {
      return {
        requestId: req.requestId,
        modelId: req.modelId,
        providerId: this.id,
        finishReason: "error",
        error: { code: String(res.status), message: "OpenRouter error" },
      };
    }

    const data = res.body as { choices?: Array<{ message?: { content?: string } }> };
    return {
      requestId: req.requestId,
      modelId: req.modelId,
      providerId: this.id,
      finishReason: "stop",
      message: data.choices?.[0]?.message?.content ?? "",
    };
  }
}
