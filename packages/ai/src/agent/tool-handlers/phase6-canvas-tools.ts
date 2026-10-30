import { z } from "zod";
import type { ToolExecutor, ToolRunContext } from "../../tool-executor.js";

const proposeInput = z
  .object({
    scope: z.enum(["all", "scene"]).default("all"),
    sceneOrdinal: z.number().int().min(1).max(50).optional(),
  })
  .refine((v) => v.scope !== "scene" || v.sceneOrdinal != null, { message: "sceneOrdinal is required for scope=scene" });

function canvas(ctx: ToolRunContext, tool: string) {
  const c = ctx.delegates?.canvas;
  if (!c) throw new Error(`${tool}: canvas delegate missing`);
  return c;
}

/**
 * Phase 6F agent tools for the scene canvas. Neither spends money: `propose_canvas_run` only puts a
 * priced approval card in the chat; the server creates the jobs when the user presses «Утвердить».
 */
export function registerPhase6CanvasTools(executor: ToolExecutor) {
  executor.register("get_canvas", z.object({}).strict(), async (_in, ctx) =>
    canvas(ctx, "get_canvas").get({ projectId: ctx.projectId, userId: ctx.userId }),
  );

  executor.register("propose_canvas_run", proposeInput, async (input, ctx) => {
    const parsed = proposeInput.parse(input);
    return canvas(ctx, "propose_canvas_run").propose({
      projectId: ctx.projectId,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      scope: parsed.scope,
      sceneOrdinal: parsed.sceneOrdinal,
    });
  });
}
