import type { AgentToolResultBlockSchema, ChatMessage } from "@shotbro/contracts";
import type { z } from "zod";
import type { CreativeSection } from "@/store/studio-store";

type AgentToolBlock = z.infer<typeof AgentToolResultBlockSchema>;

export type AutoNavTarget = {
  creativeSection: CreativeSection;
  sceneId?: string;
  assetId?: string;
  clipId?: string;
};

export type AutoNavPlan = {
  /** Keys that must never navigate (history, failed, no deepLink). Safe to mark seen at once. */
  inert: string[];
  /** Fresh successful tool results with a deepLink. Mark seen only when navigation happens. */
  navigable: string[];
  target?: AutoNavTarget;
};

/** Lookup tools: they should not pull the user away when a mutating tool ran in the same batch. */
const READ_ONLY_TOOLS = new Set([
  "search_project_assets",
  "get_storyboard",
  "get_timeline",
  "get_scene_model_capabilities",
  "estimate_cost",
  "compare_models",
]);

/** Results created this long before page load still count as fresh (server/client clock jitter). */
export const HISTORY_SKEW_MS = 5_000;

function isAgentToolBlock(block: { type: string }): block is AgentToolBlock {
  return block.type === "agent_tool_result";
}

export function autoNavKey(msg: ChatMessage, block: AgentToolBlock) {
  return `${msg.id}:${block.toolName}:${block.sceneId ?? ""}:${block.assetId ?? ""}`;
}

/**
 * Decide where auto-nav should go for tool results the user has not been navigated for yet.
 * Results created before `historyCutoffMs` (page load) are history: they never navigate, so F5 or
 * returning to the chat tab does not replay old deep links.
 */
export function planAutoNav(
  messages: ChatMessage[],
  seen: ReadonlySet<string>,
  historyCutoffMs: number,
): AutoNavPlan {
  const inert: string[] = [];
  const navigable: string[] = [];
  let lastMutating: AutoNavTarget | undefined;
  let lastReadOnly: AutoNavTarget | undefined;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const created = Date.parse(msg.createdAt);
    const historical = Number.isFinite(created) && created < historyCutoffMs - HISTORY_SKEW_MS;
    for (const block of msg.blocks ?? []) {
      if (!isAgentToolBlock(block)) continue;
      const key = autoNavKey(msg, block);
      if (seen.has(key)) continue;
      if (historical || !block.success || !block.deepLink) {
        inert.push(key);
        continue;
      }
      navigable.push(key);
      const target: AutoNavTarget = {
        creativeSection: block.deepLink.creativeSection as CreativeSection,
        sceneId: block.deepLink.sceneId,
        assetId: block.deepLink.assetId ?? block.assetId,
        clipId: block.deepLink.clipId,
      };
      if (READ_ONLY_TOOLS.has(block.toolName)) lastReadOnly = target;
      else lastMutating = target;
    }
  }

  return { inert, navigable, target: lastMutating ?? lastReadOnly };
}
