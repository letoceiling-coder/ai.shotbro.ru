import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PHASE4_MODEL_CATALOG } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";

@ApiTags("providers")
@Controller("api/v1/providers")
export class ProviderCatalogController {
  private readonly env = loadEnvFromProcess();

  @Get("model-catalog")
  catalog() {
    const liveBlocked = this.env.AI_MOCK_MODE || !this.env.PROVIDER_LIVE_EXECUTION_ENABLED;
    return {
      models: PHASE4_MODEL_CATALOG,
      liveExecutionBlocked: liveBlocked,
      policy: {
        AI_MOCK_MODE: this.env.AI_MOCK_MODE,
        PROVIDER_LIVE_EXECUTION_ENABLED: this.env.PROVIDER_LIVE_EXECUTION_ENABLED,
        OPENROUTER_ENABLED: this.env.OPENROUTER_ENABLED,
        OPENROUTER_ALLOW_PAID_REQUESTS: this.env.OPENROUTER_ALLOW_PAID_REQUESTS,
      },
    };
  }
}
