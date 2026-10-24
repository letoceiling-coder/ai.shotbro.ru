import type { Phase4ToolDefinition } from "./phase4-tool-catalog.js";
import { getPhase4Tool } from "./phase4-tool-catalog.js";

export type ToolPolicyContext = {
  userId: string;
  projectId: string;
  runId: string;
  iteration: number;
  toolCallCount: number;
  maxIterations: number;
  maxToolCalls: number;
  seenCallHashes: Set<string>;
};

export class ToolPolicyEngine {
  validate(toolId: string, input: Record<string, unknown>, ctx: ToolPolicyContext): Phase4ToolDefinition {
    const tool = getPhase4Tool(toolId);
    if (!tool || !tool.enabled) throw new Error(`Tool unavailable: ${toolId}`);

    if (ctx.iteration >= ctx.maxIterations) {
      throw new Error("Agent iteration limit exceeded");
    }
    if (ctx.toolCallCount >= ctx.maxToolCalls) {
      throw new Error("Agent tool call limit exceeded");
    }

    const hash = `${toolId}:${JSON.stringify(input)}`;
    if (ctx.seenCallHashes.has(hash)) {
      throw new Error(`Duplicate tool call blocked: ${toolId}`);
    }
    ctx.seenCallHashes.add(hash);

    return tool;
  }
}
