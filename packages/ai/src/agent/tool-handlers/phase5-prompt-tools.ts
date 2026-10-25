import { z } from "zod";
import { ScenePromptBundleSchema } from "@shotbro/contracts";
import type { ToolExecutor } from "../../tool-executor.js";

export function registerPhase5PromptStudioTools(executor: ToolExecutor) {
  executor.register(
    "get_scene_prompt",
    z.object({ sceneId: z.string() }),
    async (input, ctx) => {
      const { sceneId } = z.object({ sceneId: z.string() }).parse(input);
      if (!ctx.delegates?.getScenePrompt) throw new Error("get_scene_prompt: delegate missing");
      return ctx.delegates.getScenePrompt({ projectId: ctx.projectId, userId: ctx.userId, sceneId });
    },
  );

  executor.register(
    "save_scene_prompt",
    z.object({
      sceneId: z.string(),
      bundle: z.record(z.unknown()),
      changeNote: z.string().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({ sceneId: z.string(), bundle: z.record(z.unknown()), changeNote: z.string().optional() })
        .parse(input);
      const bundle = ScenePromptBundleSchema.parse(parsed.bundle);
      if (!ctx.delegates?.saveScenePrompt) throw new Error("save_scene_prompt: delegate missing");
      return ctx.delegates.saveScenePrompt({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        bundle,
        changeNote: parsed.changeNote,
      });
    },
  );

  executor.register(
    "list_prompt_versions",
    z.object({ sceneId: z.string() }),
    async (input, ctx) => {
      const { sceneId } = z.object({ sceneId: z.string() }).parse(input);
      if (!ctx.delegates?.listPromptVersions) throw new Error("list_prompt_versions: delegate missing");
      return ctx.delegates.listPromptVersions({ projectId: ctx.projectId, userId: ctx.userId, sceneId });
    },
  );

  executor.register(
    "compare_prompt_versions",
    z.object({ sceneId: z.string(), versionA: z.number().int().positive(), versionB: z.number().int().positive() }),
    async (input, ctx) => {
      const parsed = z
        .object({
          sceneId: z.string(),
          versionA: z.number().int().positive(),
          versionB: z.number().int().positive(),
        })
        .parse(input);
      if (!ctx.delegates?.comparePromptVersions) throw new Error("compare_prompt_versions: delegate missing");
      return ctx.delegates.comparePromptVersions({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        versionA: parsed.versionA,
        versionB: parsed.versionB,
      });
    },
  );

  executor.register(
    "restore_prompt_version",
    z.object({ sceneId: z.string(), version: z.number().int().positive() }),
    async (input, ctx) => {
      const parsed = z.object({ sceneId: z.string(), version: z.number().int().positive() }).parse(input);
      if (!ctx.delegates?.restorePromptVersion) throw new Error("restore_prompt_version: delegate missing");
      return ctx.delegates.restorePromptVersion({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        version: parsed.version,
      });
    },
  );

  executor.register(
    "get_scene_model_settings",
    z.object({ sceneId: z.string() }),
    async (input, ctx) => {
      const { sceneId } = z.object({ sceneId: z.string() }).parse(input);
      if (!ctx.delegates?.getSceneModelSettings) throw new Error("get_scene_model_settings: delegate missing");
      return ctx.delegates.getSceneModelSettings({ projectId: ctx.projectId, userId: ctx.userId, sceneId });
    },
  );

  executor.register(
    "validate_prompt_for_model",
    z.object({
      sceneId: z.string(),
      modelId: z.string(),
      operation: z.string(),
      parameters: z.record(z.unknown()).optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          sceneId: z.string(),
          modelId: z.string(),
          operation: z.string(),
          parameters: z.record(z.unknown()).optional(),
        })
        .parse(input);
      if (!ctx.delegates?.validatePromptForModel) throw new Error("validate_prompt_for_model: delegate missing");
      return ctx.delegates.validatePromptForModel({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        modelId: parsed.modelId,
        operation: parsed.operation,
        parameters: parsed.parameters,
      });
    },
  );

  executor.register(
    "prepare_scene_prompt",
    z.object({ sceneId: z.string(), focus: z.enum(["image", "video", "both"]).optional() }),
    async (input, ctx) => {
      const parsed = z
        .object({ sceneId: z.string(), focus: z.enum(["image", "video", "both"]).optional() })
        .parse(input);
      if (!ctx.delegates?.prepareScenePrompt) throw new Error("prepare_scene_prompt: delegate missing");
      return ctx.delegates.prepareScenePrompt({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        focus: parsed.focus ?? "both",
      });
    },
  );
}
