import { z } from "zod";
import { GenerationStatusSchema } from "./status";

/** Future production event contract (not used for live providers in Phase 1). */
export const AgentEventSchema = z.object({
  eventId: z.string(),
  jobId: z.string(),
  timestamp: z.string(),
  status: GenerationStatusSchema,
  payload: z.record(z.unknown()),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;
