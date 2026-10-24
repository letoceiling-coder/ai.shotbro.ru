import type { LlmRequest, LlmResponse } from "./types.js";

/** Deterministic mock planner responses for Phase 4 evaluation (no network). */
export async function mockLlmComplete(req: LlmRequest): Promise<LlmResponse> {
  const user = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = user.toLowerCase();
  const iterMatch = req.requestId.match(/-(\d+)$/);
  const iteration = iterMatch ? Number(iterMatch[1]) : 1;

  if (lower.includes("injection") || lower.includes("ignore previous")) {
    return {
      requestId: req.requestId,
      modelId: req.modelId,
      providerId: "mock-llm",
      finishReason: "stop",
      message: "Запрос отклонён политикой безопасности: подозрение на prompt injection.",
      mock: true,
      usage: { inputTokens: 120, outputTokens: 40 },
    };
  }

  const toolCalls =
    iteration === 1 &&
    req.allowedTools?.includes("update_project_brief") &&
    !lower.includes("continue")
      ? [
          {
            id: "tc_brief",
            name: "update_project_brief",
            arguments: {
              goal: "Рекламный ролик",
              format: "vertical",
              durationSeconds: 15,
              aspectRatio: "9:16",
              mock: true,
            },
          },
        ]
      : undefined;

  return {
    requestId: req.requestId,
    modelId: req.modelId,
    providerId: "mock-llm",
    finishReason: toolCalls?.length ? "tool_calls" : "stop",
    message: toolCalls ? undefined : "Mock planner: проанализировал запрос и подготовил следующий шаг.",
    toolCalls,
    structured: toolCalls
      ? undefined
      : {
          brief: {
            schemaVersion: 1,
            goal: "Рекламный ролик бренда",
            format: "9:16",
            durationSeconds: 15,
            aspectRatio: "9:16",
            mock: true,
          },
        },
    mock: true,
    usage: { inputTokens: 256, outputTokens: 128 },
  };
}
