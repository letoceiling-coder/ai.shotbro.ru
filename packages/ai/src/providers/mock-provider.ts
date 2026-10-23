import type { ProviderAdapter, ProviderRequest, ProviderResponse } from "./types.js";

/** Deterministic responses — no external API */
export class MockProviderAdapter implements ProviderAdapter {
  readonly id = "mock";

  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    const last = req.messages.filter((m) => m.role === "user").pop()?.content ?? "";
    return {
      provider: this.id,
      content: `[mock] Echo (${req.modelId}): ${last.slice(0, 500)}`,
      usage: { inputTokens: Math.ceil(last.length / 4), outputTokens: 32 },
    };
  }
}
