import { assertCreativeLlmNetworkAllowed, getOpenRouterConfig } from "@shotbro/config";
import type { AppEnv } from "@shotbro/config/env";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type { LlmRequest, LlmResponse, LlmToolCall } from "../llm/types.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport, FetchHttpTransport } from "./http-transport.js";
import type { OpenAiToolDef } from "../agent/creative-llm-tools.js";

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

  static forCreativeAgent(env: AppEnv): OpenRouterLlmAdapter {
    return new OpenRouterLlmAdapter(env, new FetchHttpTransport());
  }

  async complete(req: LlmRequest, tools?: OpenAiToolDef[]): Promise<LlmResponse> {
    if (req.executionPolicy === "CREATIVE_LLM_LIVE") {
      assertCreativeLlmNetworkAllowed(this.env);
    } else {
      this.policy.assertProviderNetworkCall();
    }

    const cfg = getOpenRouterConfig(this.env);
    const model = req.modelId || cfg.defaultModel || "openai/gpt-4o-mini";
    if (cfg.modelAllowlist.length > 0 && !cfg.modelAllowlist.includes(model)) {
      return {
        requestId: req.requestId,
        modelId: model,
        providerId: this.id,
        finishReason: "error",
        error: { code: "model_not_allowed", message: "Model not in OPENROUTER_MODEL_ALLOWLIST" },
      };
    }

    const body: Record<string, unknown> = {
      model,
      messages: req.messages.map((m) => ({
        role: m.role === "tool" ? "tool" : m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxOutputTokens,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    let res: Awaited<ReturnType<HttpTransport["request"]>>;
    try {
      res = await this.http.request({
        method: "POST",
        url: `${cfg.baseUrl}/chat/completions`,
        headers: {
          Authorization: this.env.OPENROUTER_API_KEY ? `Bearer ${this.env.OPENROUTER_API_KEY}` : "",
          "Content-Type": "application/json",
          "HTTP-Referer": this.env.APP_URL ?? "https://ai.shotbro.ru",
          "X-Title": "SHOTBRO Creative Agent",
        },
        body,
        timeoutMs: req.timeoutMs ?? 90_000,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "OpenRouter network error";
      return {
        requestId: req.requestId,
        modelId: model,
        providerId: this.id,
        finishReason: "error",
        error: { code: "network", message },
      };
    }

    if (res.status >= 400) {
      const errBody = res.body as { error?: { message?: string } } | string;
      const detail =
        typeof errBody === "object" && errBody?.error?.message
          ? errBody.error.message
          : typeof errBody === "string"
            ? errBody.slice(0, 200)
            : "OpenRouter error";
      return {
        requestId: req.requestId,
        modelId: model,
        providerId: this.id,
        finishReason: "error",
        error: { code: String(res.status), message: detail },
      };
    }

    const data = res.body as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function?: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = data.choices?.[0];
    const msg = choice?.message;
    const toolCalls: LlmToolCall[] | undefined = msg?.tool_calls?.length
      ? msg.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function?.name ?? "unknown",
          arguments: safeParseJson(tc.function?.arguments ?? "{}"),
        }))
      : undefined;

    return {
      requestId: req.requestId,
      modelId: model,
      providerId: this.id,
      finishReason: toolCalls?.length ? "tool_calls" : "stop",
      message: typeof msg?.content === "string" ? msg.content : undefined,
      toolCalls,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      mock: false,
    };
  }
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { _raw: raw };
  }
}
