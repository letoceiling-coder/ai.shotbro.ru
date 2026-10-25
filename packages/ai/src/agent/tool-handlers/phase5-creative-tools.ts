import { z } from "zod";
import type { ToolExecutor } from "../../tool-executor.js";

export function registerPhase5CreativeStudioTools(executor: ToolExecutor) {
  executor.register("get_storyboard", z.object({}).strict(), async (_in, ctx) => {
    if (!ctx.delegates?.getStoryboard) throw new Error("get_storyboard: delegate missing");
    const res = await ctx.delegates.getStoryboard({ projectId: ctx.projectId, userId: ctx.userId });
    return { ...res, mock: true };
  });

  executor.register("sync_storyboard_from_script", z.object({}).strict(), async (_in, ctx) => {
    if (!ctx.delegates?.syncStoryboard) throw new Error("sync_storyboard_from_script: delegate missing");
    const res = await ctx.delegates.syncStoryboard({ projectId: ctx.projectId, userId: ctx.userId });
    return { ...res, mock: true };
  });

  executor.register(
    "update_storyboard_scene",
    z.object({
      sceneId: z.string(),
      patch: z.record(z.unknown()),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          sceneId: z.string(),
          patch: z.record(z.unknown()),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.updateStoryboardScene) throw new Error("update_storyboard_scene: delegate missing");
      const res = await ctx.delegates.updateStoryboardScene({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        patch: { ...parsed.patch, expectedRevision: parsed.expectedRevision },
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "reorder_storyboard_scenes",
    z.object({ sceneIds: z.array(z.string()).min(1) }),
    async (input, ctx) => {
      const parsed = z.object({ sceneIds: z.array(z.string()).min(1) }).parse(input);
      if (!ctx.delegates?.reorderStoryboardScenes) throw new Error("reorder_storyboard_scenes: delegate missing");
      const res = await ctx.delegates.reorderStoryboardScenes({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneIds: parsed.sceneIds,
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "create_character",
    z.object({ name: z.string(), description: z.string().optional() }),
    async (input, ctx) => {
      const parsed = z.object({ name: z.string(), description: z.string().optional() }).parse(input);
      if (!ctx.delegates?.upsertCharacter) throw new Error("create_character: delegate missing");
      const res = await ctx.delegates.upsertCharacter({
        projectId: ctx.projectId,
        userId: ctx.userId,
        body: parsed,
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "update_character",
    z.object({
      id: z.string(),
      name: z.string(),
      expectedVersion: z.number().int().positive().optional(),
    }).passthrough(),
    async (input, ctx) => {
      const parsed = z
        .object({
          id: z.string(),
          name: z.string(),
          expectedVersion: z.number().int().positive().optional(),
        })
        .passthrough()
        .parse(input);
      if (!ctx.delegates?.upsertCharacter) throw new Error("update_character: delegate missing");
      const res = await ctx.delegates.upsertCharacter({
        projectId: ctx.projectId,
        userId: ctx.userId,
        body: parsed as Record<string, unknown> & { name: string },
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "assign_character_to_scene",
    z.object({
      characterId: z.string(),
      sceneId: z.string(),
      characterVersion: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          characterId: z.string(),
          sceneId: z.string(),
          characterVersion: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.assignCharacterToScene) throw new Error("assign_character_to_scene: delegate missing");
      const res = await ctx.delegates.assignCharacterToScene({
        projectId: ctx.projectId,
        userId: ctx.userId,
        ...parsed,
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "detach_reference",
    z.object({ linkId: z.string() }),
    async (input, ctx) => {
      const parsed = z.object({ linkId: z.string() }).parse(input);
      if (!ctx.delegates?.detachReference) throw new Error("detach_reference: delegate missing");
      const res = await ctx.delegates.detachReference({
        projectId: ctx.projectId,
        userId: ctx.userId,
        linkId: parsed.linkId,
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "set_scene_first_frame",
    z.object({
      sceneId: z.string(),
      assetId: z.string(),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          sceneId: z.string(),
          assetId: z.string(),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.setSceneFrame) throw new Error("set_scene_first_frame: delegate missing");
      const res = await ctx.delegates.setSceneFrame({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        frame: "first",
        assetId: parsed.assetId,
        expectedRevision: parsed.expectedRevision,
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "set_scene_last_frame",
    z.object({
      sceneId: z.string(),
      assetId: z.string(),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          sceneId: z.string(),
          assetId: z.string(),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.setSceneFrame) throw new Error("set_scene_last_frame: delegate missing");
      const res = await ctx.delegates.setSceneFrame({
        projectId: ctx.projectId,
        userId: ctx.userId,
        sceneId: parsed.sceneId,
        frame: "last",
        assetId: parsed.assetId,
        expectedRevision: parsed.expectedRevision,
      });
      return { ...res, mock: true };
    },
  );

  executor.register(
    "get_scene_model_capabilities",
    z.object({ modelId: z.string(), operation: z.string().default("IMAGE_TO_VIDEO") }),
    async (input) => {
      const parsed = z.object({ modelId: z.string(), operation: z.string().default("IMAGE_TO_VIDEO") }).parse(input);
      const { listCapabilities } = await import("../../providers/capability-matrix.js");
      const hit = listCapabilities({ operation: parsed.operation as never }).find((e) => e.modelId === parsed.modelId);
      return { capability: hit ?? null, mock: true };
    },
  );
}
