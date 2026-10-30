import { describe, expect, it } from "vitest";
import type { AppEnv } from "@shotbro/config/env";
import { ToolExecutor, type CanvasDelegates, type ToolRunContext } from "../tool-executor.js";
import { planCreativeIntent } from "./creative-intent-planner.js";
import { CREATIVE_LLM_TOOL_IDS, buildCreativeOpenAiTools } from "./creative-llm-tools.js";
import { getPhase4Tool } from "./phase4-tool-catalog.js";
import { registerPhase6CanvasTools } from "./tool-handlers/phase6-canvas-tools.js";

const env = { AI_MOCK_MODE: true, PROVIDER_LIVE_EXECUTION_ENABLED: false, MEDIA_GENERATION_ENABLED: false } as unknown as AppEnv;

function storage() {
  const execs = new Map<string, Record<string, unknown>>();
  return {
    findToolExecution: async (_run: string, key: string) => execs.get(key) ?? null,
    saveToolExecution: async (row: Record<string, unknown>) => void execs.set(String(row.idempotencyKey), row),
    emitEvent: async () => undefined,
  };
}

describe("Phase 6F canvas agent tools", () => {
  it("are in the catalog as free tools and exposed to the LLM", () => {
    for (const id of ["get_canvas", "propose_canvas_run"]) {
      expect(getPhase4Tool(id)).toMatchObject({ costClass: "free", enabled: true });
      expect(CREATIVE_LLM_TOOL_IDS).toContain(id);
      expect(buildCreativeOpenAiTools().some((t) => t.function.name === id)).toBe(true);
    }
    expect(getPhase4Tool("propose_canvas_run")?.sideEffect).not.toBe("EXTERNAL_PAID");
  });

  it("mock planner: whole video vs one scene", () => {
    expect(planCreativeIntent("phase6f собери ролик на холсте")?.toolCalls.map((t) => [t.name, t.arguments])).toEqual([
      ["get_canvas", {}],
      ["propose_canvas_run", { scope: "all" }],
    ]);
    expect(planCreativeIntent("Переделай вторую сцену на холсте")?.toolCalls[1]).toMatchObject({
      name: "propose_canvas_run",
      arguments: { scope: "scene", sceneOrdinal: 2 },
    });
  });

  it("propose only forwards to the delegate (price card), with the chat conversation", async () => {
    const calls: unknown[] = [];
    const canvas: CanvasDelegates = {
      get: async () => ({ scenes: [] }),
      propose: async (input) => {
        calls.push(input);
        return { quote: { totalEstimatedLiveUsd: 0.5, mock: true }, awaitingUserApproval: true };
      },
    };
    const ex = new ToolExecutor(env);
    registerPhase6CanvasTools(ex);
    const ctx = {
      env,
      storage: storage(),
      runId: "r",
      projectId: "p",
      userId: "u",
      conversationId: "c",
      delegates: { canvas },
    } as unknown as ToolRunContext;
    const out = await ex.execute("propose_canvas_run", { scope: "scene", sceneOrdinal: 1 }, ctx, { idempotencyKey: "k1" });
    expect(out.awaitingUserApproval).toBe(true);
    expect(calls).toEqual([{ projectId: "p", userId: "u", conversationId: "c", scope: "scene", sceneOrdinal: 1 }]);
    await expect(ex.execute("propose_canvas_run", { scope: "scene" }, ctx, { idempotencyKey: "k2" })).rejects.toThrow();
  });
});
