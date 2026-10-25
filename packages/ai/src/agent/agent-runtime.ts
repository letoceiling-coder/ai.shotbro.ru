import type { AppEnv } from "@shotbro/config/env";
import { LlmGateway } from "../llm/llm-gateway.js";
import type { LlmResponse } from "../llm/types.js";
import type { ProductionStoragePort } from "../ports/production-storage.js";
import { ToolExecutor, type ToolExecutionDelegates } from "../tool-executor.js";
import { ContextBuilder } from "./context-builder.js";
import { ToolPolicyEngine } from "./tool-policy-engine.js";
import { registerPhase4ToolHandlers } from "./tool-handlers/register.js";
import { registerMultiproviderTools } from "./tool-handlers/multiprovider-tools.js";
import { registerPhase5CreativeStudioTools } from "./tool-handlers/phase5-creative-tools.js";

export type AgentRuntimeLimits = {
  maxIterations: number;
  maxToolCalls: number;
  maxDurationMs: number;
};

export type AgentRunResult = {
  status: "completed" | "waiting_approval" | "failed" | "stopped";
  iterations: number;
  toolCalls: number;
  lastLlm?: LlmResponse;
  error?: string;
};

const DEFAULT_LIMITS: AgentRuntimeLimits = {
  maxIterations: 12,
  maxToolCalls: 24,
  maxDurationMs: 120_000,
};

export class AgentRuntime {
  private readonly llm: LlmGateway;
  private readonly contextBuilder = new ContextBuilder();
  private readonly policy = new ToolPolicyEngine();
  private readonly executor: ToolExecutor;

  constructor(private readonly env: AppEnv) {
    this.llm = new LlmGateway(env);
    this.executor = new ToolExecutor(env);
    registerPhase4ToolHandlers(this.executor);
    registerMultiproviderTools(this.executor, env);
    registerPhase5CreativeStudioTools(this.executor);
  }

  async runTurn(input: {
    runId: string;
    projectId: string;
    userId: string;
    userMessage: string;
    storage: ProductionStoragePort;
    conversationId?: string;
    delegates?: ToolExecutionDelegates;
    modelId?: string;
    limits?: Partial<AgentRuntimeLimits>;
  }): Promise<AgentRunResult> {
    const limits = { ...DEFAULT_LIMITS, ...input.limits };
    const started = Date.now();
    const seen = new Set<string>();
    let iterations = 0;
    let toolCalls = 0;
    let lastLlm: LlmResponse | undefined;

    const ctx = await this.contextBuilder.build({
      userMessage: input.userMessage,
      projectId: input.projectId,
      runId: input.runId,
      storage: input.storage,
    });

    while (iterations < limits.maxIterations) {
      if (Date.now() - started > limits.maxDurationMs) {
        return { status: "stopped", iterations, toolCalls, lastLlm, error: "Time limit exceeded" };
      }
      iterations++;

      const llmRes = await this.llm.complete({
        requestId: `${input.runId}-${iterations}`,
        modelId: input.modelId ?? "mock/text-std",
        systemInstructions: "You are SHOTBRO AI Producer. Use tools when needed. Mock-only mode.",
        messages: [
          { role: "system", content: ctx.compactText },
          { role: "user", content: input.userMessage },
        ],
        allowedTools: [
          "get_project_context",
          "update_project_brief",
          "create_production_plan",
          "create_script",
          "create_storyboard",
          "estimate_cost",
          "request_approval",
        ],
        executionPolicy: "MOCK_ONLY",
      });
      lastLlm = llmRes;

      if (!llmRes.toolCalls?.length) {
        return { status: "completed", iterations, toolCalls, lastLlm };
      }

      for (const tc of llmRes.toolCalls) {
        this.policy.validate(tc.name, tc.arguments, {
          userId: input.userId,
          projectId: input.projectId,
          runId: input.runId,
          iteration: iterations,
          toolCallCount: toolCalls,
          maxIterations: limits.maxIterations,
          maxToolCalls: limits.maxToolCalls,
          seenCallHashes: seen,
        });
        toolCalls++;
        await this.executor.execute(tc.name, tc.arguments, {
          env: this.env,
          storage: input.storage,
          runId: input.runId,
          projectId: input.projectId,
          userId: input.userId,
          conversationId: input.conversationId,
          delegates: input.delegates,
        }, { idempotencyKey: `${input.runId}:${tc.id}`, timeoutMs: 30_000 });

        if (tc.name === "request_approval") {
          return { status: "waiting_approval", iterations, toolCalls, lastLlm };
        }
      }
    }

    return { status: "stopped", iterations, toolCalls, lastLlm, error: "Iteration limit exceeded" };
  }
}
