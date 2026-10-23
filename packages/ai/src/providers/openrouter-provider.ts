import { assertOpenRouterRequestsAllowed, getOpenRouterConfig, type OpenRouterServerConfig } from "@shotbro/config/openrouter";
import type { AppEnv } from "@shotbro/config/env";
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from "./types.js";

export class OpenRouterProviderAdapter implements ProviderAdapter {
  readonly id = "openrouter";
  private readonly cfg: OpenRouterServerConfig;

  constructor(env: AppEnv) {
    this.cfg = getOpenRouterConfig(env);
  }

  async complete(_req: ProviderRequest): Promise<ProviderResponse> {
    assertOpenRouterRequestsAllowed(this.cfg);
    throw new Error("OpenRouter adapter must not be invoked in Phase 2");
  }
}
