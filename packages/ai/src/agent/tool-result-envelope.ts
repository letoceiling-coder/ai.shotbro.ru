import { z } from "zod";

export const AgentToolResultEnvelopeSchema = z.object({
  success: z.boolean(),
  errorCode: z.string().optional(),
  humanReadableSummary: z.string(),
  projectId: z.string(),
  toolName: z.string(),
  assetId: z.string().optional(),
  sceneId: z.string().optional(),
  documentId: z.string().optional(),
  revision: z.number().optional(),
  approvalState: z.string().optional(),
  resultingAction: z.string().optional(),
  mockAgent: z.literal(true),
  deepLink: z
    .object({
      creativeSection: z.enum([
        "chat",
        "storyboard",
        "assets",
        "timeline",
        "prompts",
        "references",
        "characters",
        "models",
      ]),
      sceneId: z.string().optional(),
      assetId: z.string().optional(),
      clipId: z.string().optional(),
    })
    .optional(),
  payload: z.record(z.unknown()).optional(),
});

export type AgentToolResultEnvelope = z.infer<typeof AgentToolResultEnvelopeSchema>;

export function toolSuccess(
  partial: Omit<AgentToolResultEnvelope, "success" | "mockAgent">,
): AgentToolResultEnvelope {
  return { ...partial, success: true, mockAgent: true };
}

export function toolError(
  partial: Omit<AgentToolResultEnvelope, "success" | "mockAgent"> & { errorCode: string },
): AgentToolResultEnvelope {
  return { ...partial, success: false, mockAgent: true };
}
