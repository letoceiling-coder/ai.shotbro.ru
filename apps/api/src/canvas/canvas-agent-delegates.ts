import type { CanvasDelegates } from "@shotbro/ai";
import type { CanvasService } from "./canvas.service";

/** Phase 6F: agent-facing adapter over CanvasService (same checks and price card as the UI). */
export function buildCanvasAgentDelegates(canvas: CanvasService): CanvasDelegates {
  return {
    get: ({ userId, projectId }) => canvas.agentSummary(userId, projectId),
    propose: async ({ userId, projectId, conversationId, scope, sceneOrdinal }) => ({
      quote: await canvas.proposeForAgent(userId, projectId, { conversationId, scope, sceneOrdinal }),
      awaitingUserApproval: true,
    }),
  };
}
