import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  listCapabilities,
  PROVIDER_CAPABILITY_MATRIX,
  ProviderFallbackPlanner,
  type CanonicalSceneSettings,
} from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { isProviderConfigured, isProviderLiveEligible } from "@shotbro/config/provider-policy";

@ApiTags("providers")
@Controller("api/v1/providers")
export class ProviderRouterController {
  private readonly env = loadEnvFromProcess();

  @Get("capabilities")
  capabilities() {
    return {
      items: PROVIDER_CAPABILITY_MATRIX,
      policy: {
        AI_MOCK_MODE: this.env.AI_MOCK_MODE,
        PROVIDER_LIVE_EXECUTION_ENABLED: this.env.PROVIDER_LIVE_EXECUTION_ENABLED,
        FAL_PROVIDER_ENABLED: this.env.FAL_PROVIDER_ENABLED,
        ELEVENLABS_PROVIDER_ENABLED: this.env.ELEVENLABS_PROVIDER_ENABLED,
        MAGNIFIC_PROVIDER_ENABLED: this.env.MAGNIFIC_PROVIDER_ENABLED,
        OPENROUTER_FALLBACK_ROUTING_ENABLED: this.env.OPENROUTER_FALLBACK_ROUTING_ENABLED,
      },
    };
  }

  @Post("route-plan")
  planRoute(@Body() body: CanonicalSceneSettings & { primaryUnavailable?: boolean; failureClass?: string }) {
    const planner = new ProviderFallbackPlanner(this.env);
    const plan = planner.plan(body, {
      primaryUnavailable: body.primaryUnavailable,
      failureClass: body.failureClass as "PRE_SUBMIT_FAILURE" | "POST_SUBMIT_AMBIGUOUS" | undefined,
    });
    return {
      plan,
      liveEligible: plan.selected
        ? isProviderLiveEligible(this.env, plan.selected.providerId as never)
        : false,
      configured: plan.selected ? isProviderConfigured(this.env, plan.selected.providerId as never) : false,
      mockRoutingOnly: this.env.AI_MOCK_MODE || !this.env.PROVIDER_LIVE_EXECUTION_ENABLED,
    };
  }

  @Get("registry")
  registry() {
    return { providers: listCapabilities() };
  }
}
