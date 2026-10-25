import { z } from "zod";
import type { ToolExecutor } from "../../tool-executor.js";
import { listCapabilities, PROVIDER_CAPABILITY_MATRIX } from "../../providers/capability-matrix.js";
import { getModelParameterDefinition } from "../../model-parameters/registry.js";
import { ModelParameterValidator } from "../../model-parameters/validator.js";
import { ProviderFallbackPlanner } from "../../providers/routing/fallback-planner.js";
import type { CanonicalSceneSettings } from "../../providers/routing/types.js";

export function registerMultiproviderTools(executor: ToolExecutor, env: import("@shotbro/config/env").AppEnv) {
  executor.register("list_providers", z.object({}).strict(), async () => {
    const providers = [...new Set(PROVIDER_CAPABILITY_MATRIX.map((e) => e.providerId))];
    return { providers, mock: true };
  });

  executor.register(
    "list_available_models",
    z.object({ operation: z.string().optional() }).strict(),
    async (input) => {
      const items = listCapabilities(
        input.operation ? { operation: input.operation as never } : undefined,
      );
      return { items, mock: true };
    },
  );

  executor.register(
    "get_model_capabilities",
    z.object({ providerId: z.string(), modelId: z.string(), operation: z.string() }),
    async (input) => {
      const hit = listCapabilities({ operation: input.operation as never, providerId: input.providerId }).find(
        (e) => e.modelId === input.modelId,
      );
      return { capability: hit ?? null, mock: true };
    },
  );

  executor.register("get_model_parameters", z.object({ modelId: z.string() }), async (input) => {
    const def = getModelParameterDefinition(input.modelId);
    return { definition: def ?? null, mock: true };
  });

  executor.register("get_model_pricing", z.object({ modelId: z.string() }), async (input) => {
    const cap = PROVIDER_CAPABILITY_MATRIX.find((e) => e.modelId === input.modelId);
    return {
      priceStatus: cap?.priceStatus ?? "UNKNOWN",
      pricingSource: cap?.pricingSource ?? "UNKNOWN",
      mock: true,
    };
  });

  executor.register(
    "plan_provider_fallback",
    z.object({
      sceneId: z.string(),
      operation: z.string(),
      primaryUnavailable: z.boolean().optional(),
      strictVoiceConsistency: z.boolean().optional(),
      fallbackMode: z.enum(["disabled", "automatic_compatible", "ask_before_switch"]).optional(),
    }),
    async (input) => {
      const settings: CanonicalSceneSettings = {
        sceneId: input.sceneId,
        operation: input.operation as CanonicalSceneSettings["operation"],
        strictVoiceConsistency: input.strictVoiceConsistency,
        fallbackMode: input.fallbackMode,
      };
      const plan = new ProviderFallbackPlanner(env).plan(settings, {
        primaryUnavailable: input.primaryUnavailable,
      });
      return { plan, mock: true, note: "routing_simulation_only" };
    },
  );

  executor.register(
    "validate_model_settings",
    z.object({ modelId: z.string(), operation: z.string(), parameters: z.record(z.unknown()) }),
    async (input) => {
      const v = new ModelParameterValidator().validate(input.modelId, input.operation, input.parameters);
      return { ...v, mock: true };
    },
  );

  executor.register(
    "explain_provider_choice",
    z.object({ sceneId: z.string(), operation: z.string() }),
    async (input) => {
      const plan = new ProviderFallbackPlanner(env).plan({
        sceneId: input.sceneId,
        operation: input.operation as CanonicalSceneSettings["operation"],
      });
      return {
        summary: plan.status,
        primary: plan.primary,
        selected: plan.selected,
        events: plan.events,
        mock: true,
      };
    },
  );

  executor.register("compare_providers", z.object({ operation: z.string() }), async (input) => {
    const items = listCapabilities({ operation: input.operation as never });
    return { items, mock: true };
  });

  executor.register("recommend_model_settings", z.object({ modelId: z.string() }), async (input) => {
    const def = getModelParameterDefinition(input.modelId);
    return { presets: def?.presets ?? [], defaults: def?.defaultParameters ?? {}, mock: true };
  });

  executor.register("validate_fallback_compatibility", z.object({ operation: z.string() }), async (input) => {
    const plan = new ProviderFallbackPlanner(env).plan(
      { sceneId: "tool", operation: input.operation as CanonicalSceneSettings["operation"] },
      { primaryUnavailable: true },
    );
    return { compatible: plan.status === "FALLBACK_PLANNED", plan, mock: true };
  });

  executor.register(
    "estimate_workflow_cost",
    z.object({ sceneCount: z.number().int().positive().default(3) }),
    async (input) => {
      return {
        note: "UNKNOWN pricing not treated as zero",
        totalUsd: null,
        priceStatus: "UNKNOWN",
        sceneCount: input.sceneCount,
        mock: true,
      };
    },
  );
}
