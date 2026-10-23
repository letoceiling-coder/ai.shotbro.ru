import { z } from "zod";
import { ChatMessageSchema } from "./blocks";
import { GenerationStatusSchema } from "./status";

export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  archived: z.boolean().default(false),
  demo: z.literal(true),
  demoScenarioId: z.enum(["ad", "avatar", "cartoon", "photo"]),
  updatedAt: z.string(),
  messages: z.array(ChatMessageSchema),
  workflowStatus: GenerationStatusSchema,
  activePanel: z
    .enum([
      "none",
      "files",
      "script",
      "storyboard",
      "first_frame",
      "generation",
      "models",
      "result",
      "versions",
      "simulator",
    ])
    .default("none"),
});

export type Project = z.infer<typeof ProjectSchema>;
