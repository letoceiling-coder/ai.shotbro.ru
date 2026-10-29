import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@shotbro/contracts";
import { HISTORY_SKEW_MS, planAutoNav } from "./agent-auto-nav";

const LOADED_AT = Date.parse("2026-10-30T12:00:00Z");

function tool(
  toolName: string,
  section: string,
  extra: { success?: boolean; sceneId?: string; noLink?: boolean } = {},
) {
  return {
    type: "agent_tool_result" as const,
    toolName,
    success: extra.success ?? true,
    humanReadableSummary: toolName,
    projectId: "p1",
    sceneId: extra.sceneId,
    deepLink: extra.noLink
      ? undefined
      : { creativeSection: section as "storyboard", sceneId: extra.sceneId },
  };
}

function msg(id: string, createdAtMs: number, blocks: unknown[]): ChatMessage {
  return {
    id,
    role: "assistant",
    createdAt: new Date(createdAtMs).toISOString(),
    blocks: blocks as ChatMessage["blocks"],
  };
}

const unifiedRun = (id: string, at: number) =>
  msg(id, at, [
    tool("search_project_assets", "assets"),
    tool("get_scene_model_capabilities", "storyboard"),
    tool("get_timeline", "timeline"),
    tool("set_scene_first_frame_by_ordinal", "storyboard", { sceneId: "s2" }),
  ]);

describe("planAutoNav", () => {
  it("does not replay tool results created before page load (F5 / back to chat)", () => {
    const plan = planAutoNav([unifiedRun("m1", LOADED_AT - 60_000)], new Set(), LOADED_AT);
    expect(plan.target).toBeUndefined();
    expect(plan.navigable).toHaveLength(0);
    expect(plan.inert).toHaveLength(4);
  });

  it("navigates once to the mutating tool section for a fresh run", () => {
    const plan = planAutoNav([unifiedRun("m1", LOADED_AT + 10_000)], new Set(), LOADED_AT);
    expect(plan.target).toEqual({ creativeSection: "storyboard", sceneId: "s2", assetId: undefined, clipId: undefined });
    expect(plan.navigable).toHaveLength(4);
  });

  it("falls back to the last read-only tool when nothing mutated", () => {
    const plan = planAutoNav(
      [msg("m1", LOADED_AT + 1, [tool("search_project_assets", "assets")])],
      new Set(),
      LOADED_AT,
    );
    expect(plan.target?.creativeSection).toBe("assets");
  });

  it("skips seen, failed and link-less results", () => {
    const fresh = msg("m1", LOADED_AT + 1, [
      tool("set_scene_first_frame", "storyboard", { success: false }),
      tool("attach_reference", "references", { noLink: true }),
      tool("update_storyboard_scene", "storyboard"),
    ]);
    const seen = new Set(["m1:update_storyboard_scene::"]);
    const plan = planAutoNav([fresh], seen, LOADED_AT);
    expect(plan.target).toBeUndefined();
    expect(plan.inert).toHaveLength(2);
  });

  it("treats results within clock skew of page load as fresh", () => {
    const plan = planAutoNav(
      [msg("m1", LOADED_AT - HISTORY_SKEW_MS + 1, [tool("update_storyboard_scene", "storyboard")])],
      new Set(),
      LOADED_AT,
    );
    expect(plan.target?.creativeSection).toBe("storyboard");
  });
});
