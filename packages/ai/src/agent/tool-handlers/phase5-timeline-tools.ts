import { z } from "zod";
import { TimelineClipSchema } from "@shotbro/contracts";
import type { ToolExecutor } from "../../tool-executor.js";

export function registerPhase5TimelineTools(executor: ToolExecutor) {
  executor.register("get_timeline", z.object({}).strict(), async (_input, ctx) => {
    if (!ctx.delegates?.getTimeline) throw new Error("get_timeline: delegate missing");
    return ctx.delegates.getTimeline({ projectId: ctx.projectId, userId: ctx.userId });
  });

  executor.register(
    "create_timeline_from_storyboard",
    z.object({ preview: z.boolean().optional() }).strict(),
    async (input, ctx) => {
      const { preview } = z.object({ preview: z.boolean().optional() }).parse(input);
      if (!ctx.delegates?.createTimelineFromStoryboard) {
        throw new Error("create_timeline_from_storyboard: delegate missing");
      }
      return ctx.delegates.createTimelineFromStoryboard({
        projectId: ctx.projectId,
        userId: ctx.userId,
        preview: preview ?? false,
      });
    },
  );

  executor.register(
    "update_timeline_clip",
    z.object({
      clip: z.record(z.unknown()),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          clip: z.record(z.unknown()),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      const clip = TimelineClipSchema.parse(parsed.clip);
      if (!ctx.delegates?.updateTimelineClip) throw new Error("update_timeline_clip: delegate missing");
      return ctx.delegates.updateTimelineClip({
        projectId: ctx.projectId,
        userId: ctx.userId,
        clip,
        expectedRevision: parsed.expectedRevision,
      });
    },
  );

  executor.register(
    "reorder_timeline_clips",
    z.object({
      trackId: z.string().min(1),
      clipIds: z.array(z.string().min(1)).min(1),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          trackId: z.string().min(1),
          clipIds: z.array(z.string().min(1)).min(1),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.reorderTimelineClips) throw new Error("reorder_timeline_clips: delegate missing");
      return ctx.delegates.reorderTimelineClips({
        projectId: ctx.projectId,
        userId: ctx.userId,
        ...parsed,
      });
    },
  );

  executor.register(
    "set_clip_duration",
    z.object({
      clipId: z.string().min(1),
      durationMs: z.number().int().positive(),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          clipId: z.string().min(1),
          durationMs: z.number().int().positive(),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.setClipDuration) throw new Error("set_clip_duration: delegate missing");
      return ctx.delegates.setClipDuration({
        projectId: ctx.projectId,
        userId: ctx.userId,
        ...parsed,
      });
    },
  );

  executor.register(
    "attach_audio_track",
    z.object({
      assetId: z.string().min(1),
      trackType: z.enum(["VOICEOVER", "MUSIC", "SFX"]).default("VOICEOVER"),
      startTimeMs: z.number().int().min(0).default(0),
      durationMs: z.number().int().positive(),
      volume: z.number().min(0).max(2).optional(),
      expectedRevision: z.number().int().positive().optional(),
    }),
    async (input, ctx) => {
      const parsed = z
        .object({
          assetId: z.string().min(1),
          trackType: z.enum(["VOICEOVER", "MUSIC", "SFX"]).default("VOICEOVER"),
          startTimeMs: z.number().int().min(0).default(0),
          durationMs: z.number().int().positive(),
          volume: z.number().min(0).max(2).optional(),
          expectedRevision: z.number().int().positive().optional(),
        })
        .parse(input);
      if (!ctx.delegates?.attachAudioTrack) throw new Error("attach_audio_track: delegate missing");
      return ctx.delegates.attachAudioTrack({
        projectId: ctx.projectId,
        userId: ctx.userId,
        ...parsed,
      });
    },
  );

  executor.register("validate_timeline", z.object({}).strict(), async (_input, ctx) => {
    if (!ctx.delegates?.validateTimeline) throw new Error("validate_timeline: delegate missing");
    return ctx.delegates.validateTimeline({ projectId: ctx.projectId, userId: ctx.userId });
  });

  executor.register("prepare_timeline_assembly", z.object({}).strict(), async (_input, ctx) => {
    if (!ctx.delegates?.prepareTimelineAssembly) throw new Error("prepare_timeline_assembly: delegate missing");
    return ctx.delegates.prepareTimelineAssembly({ projectId: ctx.projectId, userId: ctx.userId });
  });
}
