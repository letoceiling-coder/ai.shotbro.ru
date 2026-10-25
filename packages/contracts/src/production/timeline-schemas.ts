import { z } from "zod";

export const TimelineTrackTypeSchema = z.enum(["VIDEO", "VOICEOVER", "MUSIC", "SFX"]);

export const TimelineClipStatusSchema = z.enum(["draft", "ready", "missing", "error"]);

export const TimelineClipSchema = z.object({
  clipId: z.string(),
  sceneId: z.string().optional(),
  assetId: z.string().optional(),
  trackId: z.string(),
  startTimeMs: z.number().int().min(0).default(0),
  sourceInMs: z.number().int().min(0).default(0),
  sourceOutMs: z.number().int().min(0).optional(),
  durationMs: z.number().int().positive(),
  order: z.number().int().min(0),
  volume: z.number().min(0).max(2).default(1),
  muted: z.boolean().default(false),
  status: TimelineClipStatusSchema.default("draft"),
  fitMode: z.enum(["contain", "cover", "stretch"]).optional(),
});

export const TimelineTrackSchema = z.object({
  id: z.string(),
  type: TimelineTrackTypeSchema,
  label: z.string().optional(),
  clips: z.array(TimelineClipSchema).default([]),
});

export const TimelineResolutionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const TimelineDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  format: z.string().default("mp4"),
  fps: z.number().positive().default(30),
  aspectRatio: z.string().default("9:16"),
  resolution: TimelineResolutionSchema.default({ width: 720, height: 1280 }),
  totalDurationMs: z.number().int().min(0),
  revision: z.number().int().positive().default(1),
  tracks: z.array(TimelineTrackSchema).min(1),
  storyboardDocumentVersion: z.number().int().positive().optional(),
  mock: z.literal(true).optional(),
});

export type TimelineDocument = z.infer<typeof TimelineDocumentSchema>;
export type TimelineClip = z.infer<typeof TimelineClipSchema>;
export type TimelineTrack = z.infer<typeof TimelineTrackSchema>;

export function defaultTimelineTracks(): TimelineTrack[] {
  return [
    { id: "track-video", type: "VIDEO", label: "Video", clips: [] },
    { id: "track-voice", type: "VOICEOVER", label: "Voiceover", clips: [] },
    { id: "track-music", type: "MUSIC", label: "Music", clips: [] },
    { id: "track-sfx", type: "SFX", label: "SFX", clips: [] },
  ];
}

export function parseTimelineDocument(raw: unknown): TimelineDocument {
  const legacy = raw as { schemaVersion?: number; scenes?: unknown[] };
  if (legacy?.schemaVersion !== 2) {
    throw new Error("legacy_timeline");
  }
  return TimelineDocumentSchema.parse(raw);
}
