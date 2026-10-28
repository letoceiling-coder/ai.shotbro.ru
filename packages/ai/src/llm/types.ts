import { z } from "zod";

export const LlmToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});

export const LlmMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(LlmToolCallSchema).optional(),
});

export const LlmRequestSchema = z.object({
  requestId: z.string(),
  modelId: z.string(),
  systemInstructions: z.string().optional(),
  messages: z.array(LlmMessageSchema).min(1),
  allowedTools: z.array(z.string()).optional(),
  responseSchema: z.record(z.unknown()).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  executionPolicy: z
    .enum(["MOCK_ONLY", "LIVE_CONFIGURED_DISABLED", "LIVE_APPROVED", "CREATIVE_LLM_LIVE"])
    .default("MOCK_ONLY"),
});

export const LlmUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const LlmResponseSchema = z.object({
  requestId: z.string(),
  message: z.string().optional(),
  structured: z.record(z.unknown()).optional(),
  toolCalls: z.array(LlmToolCallSchema).optional(),
  usage: LlmUsageSchema.optional(),
  modelId: z.string(),
  providerId: z.string(),
  finishReason: z.enum(["stop", "tool_calls", "length", "error"]).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  mock: z.boolean().optional(),
});

export type LlmMessage = z.infer<typeof LlmMessageSchema>;
export type LlmRequest = z.infer<typeof LlmRequestSchema>;
export type LlmResponse = z.infer<typeof LlmResponseSchema>;
export type LlmToolCall = z.infer<typeof LlmToolCallSchema>;

export type LlmTransport = {
  complete(req: LlmRequest): Promise<LlmResponse>;
};
