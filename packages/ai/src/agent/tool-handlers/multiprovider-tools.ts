import { z } from "zod";
import type { ToolExecutor } from "../../tool-executor.js";
import { listCapabilities, PROVIDER_CAPABILITY_MATRIX } from "../../providers/capability-matrix.js";
import { getModelParameterDefinition } from "../../model-parameters/registry.js";
import { ModelParameterValidator } from "../../model-parameters/validator.js";
import { ProviderFallbackPlanner } from "../../providers/routing/fallback-planner.js";
import type { CanonicalSceneSettings } from "../../providers/routing/types.js";

const operationOpt = z.object({ operation: z.string().optional() });
const modelCaps = z.object({ providerId: z.string(), modelId: z.string(), operation: z.string() });
const modelIdOnly = z.object({ modelId: z.string() });
const operationOnly = z.object({ operation: z.string() });
const planFallback = z.object({
  sceneId: z.string(),
  operation: z.string(),
  primaryUnavailable: z.boolean().optional(),
  strictVoiceConsistency: z.boolean().optional(),
  fallbackMode: z.enum(["disabled", "automatic_compatible", "ask_before_switch"]).optional(),
});
const validateSettings = z.object({
  modelId: z.string(),
  operation: z.string(),
  parameters: z.record(z.unknown()),
});
const explainChoice = z.object({ sceneId: z.string(), operation: z.string() });
const sceneCount = z.object({ sceneCount: z.number().int().positive().default(3) });

export function registerMultiproviderTools(executor: ToolExecutor, env: import("@shotbro/config/env").AppEnv) {
  executor.register("list_providers", z.object({}).strict(), async () => {
    const providers = [...new Set(PROVIDER_CAPABILITY_MATRIX.map((e) => e.providerId))];
    return { providers, mock: true };
  });

  executor.register("list_available_models", operationOpt.strict(), async (raw) => {
    const input = operationOpt.parse(raw);
    const items = listCapabilities(
      input.operation ? { operation: input.operation as never } : undefined,
    );
    return { items, mock: true };
  });

  executor.register("get_model_capabilities", modelCaps, async (raw) => {
    const input = modelCaps.parse(raw);
    const hit = listCapabilities({ operation: input.operation as never, providerId: input.providerId }).find(
      (e) => e.modelId === input.modelId,
    );
    return { capability: hit ?? null, mock: true };
  });

  executor.register("get_model_parameters", modelIdOnly, async (raw) => {
    const input = modelIdOnly.parse(raw);
    const def = getModelParameterDefinition(input.modelId);
    return { definition: def ?? null, mock: true };
  });

  executor.register("get_model_pricing", modelIdOnly, async (raw) => {
    const input = modelIdOnly.parse(raw);
    const cap = PROVIDER_CAPABILITY_MATRIX.find((e) => e.modelId === input.modelId);
    return {
      priceStatus: cap?.priceStatus ?? "UNKNOWN",
      pricingSource: cap?.pricingSource ?? "UNKNOWN",
      mock: true,
    };
  });

  executor.register("plan_provider_fallback", planFallback, async (raw) => {
    const input = planFallback.parse(raw);
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
  });

  executor.register("validate_model_settings", validateSettings, async (raw) => {
    const input = validateSettings.parse(raw);
    const v = new ModelParameterValidator().validate(input.modelId, input.operation, input.parameters);
    return { ...v, mock: true };
  });

  executor.register("explain_provider_choice", explainChoice, async (raw) => {
    const input = explainChoice.parse(raw);
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
  });

  executor.register("compare_providers", operationOnly, async (raw) => {
    const input = operationOnly.parse(raw);
    const items = listCapabilities({ operation: input.operation as never });
    return { items, mock: true };
  });

  executor.register("recommend_model_settings", modelIdOnly, async (raw) => {
    const input = modelIdOnly.parse(raw);
    const def = getModelParameterDefinition(input.modelId);
    return { presets: def?.presets ?? [], defaults: def?.defaultParameters ?? {}, mock: true };
  });

  executor.register("validate_fallback_compatibility", operationOnly, async (raw) => {
    const input = operationOnly.parse(raw);
    const plan = new ProviderFallbackPlanner(env).plan(
      { sceneId: "tool", operation: input.operation as CanonicalSceneSettings["operation"] },
      { primaryUnavailable: true },
    );
    return { compatible: plan.status === "FALLBACK_PLANNED", plan, mock: true };
  });

  executor.register("estimate_workflow_cost", sceneCount, async (raw) => {
    const input = sceneCount.parse(raw);
    return {
      note: "UNKNOWN pricing not treated as zero",
      totalUsd: null,
      priceStatus: "UNKNOWN",
      sceneCount: input.sceneCount,
      mock: true,
    };
  });
}
