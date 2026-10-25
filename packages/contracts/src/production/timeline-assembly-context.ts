import { z } from "zod";

/** Immutable montage snapshot bound to a production run / BullMQ job. */
export const TimelineAssemblyContextSchema = z.object({
  timelineDocumentId: z.string().min(1),
  timelineVersion: z.number().int().positive(),
  timelineHash: z.string().min(16),
});

export type TimelineAssemblyContext = z.infer<typeof TimelineAssemblyContextSchema>;

export function mergeTimelineAssemblyContext(
  job: Partial<TimelineAssemblyContext> | undefined,
  runMetadata: Partial<TimelineAssemblyContext> | undefined,
): TimelineAssemblyContext | null {
  const timelineDocumentId = job?.timelineDocumentId ?? runMetadata?.timelineDocumentId;
  const timelineVersion = job?.timelineVersion ?? runMetadata?.timelineVersion;
  const timelineHash = job?.timelineHash ?? runMetadata?.timelineHash;
  if (!timelineDocumentId || !timelineVersion || !timelineHash) return null;
  const parsed = TimelineAssemblyContextSchema.safeParse({ timelineDocumentId, timelineVersion, timelineHash });
  return parsed.success ? parsed.data : null;
}
