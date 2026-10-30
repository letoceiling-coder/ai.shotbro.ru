import { describe, expect, it } from "vitest";
import type { SceneCanvasPayload } from "@shotbro/contracts";
import { fromFlow, runnableAncestors, toFlowEdges, toFlowNodes } from "./canvas-graph";

const payload: SceneCanvasPayload = {
  schemaVersion: 1,
  nodes: [
    { id: "scene:s1:prompt", kind: "prompt", sceneId: "s1", position: { x: 0, y: 0 }, data: {} },
    { id: "scene:s1:frame", kind: "first_frame", sceneId: "s1", position: { x: 340, y: 0 }, data: {} },
    { id: "scene:s1:video", kind: "scene_video", sceneId: "s1", position: { x: 680, y: 0 }, data: { durationSeconds: 4 } },
    { id: "assembly", kind: "assembly", position: { x: 1060, y: 0 }, data: {} },
    { id: "output", kind: "output", position: { x: 1380, y: 0 }, data: {} },
    { id: "loose", kind: "upscale", position: { x: 0, y: 500 }, data: {} },
  ],
  edges: [
    { id: "e1", source: "scene:s1:prompt", target: "scene:s1:frame" },
    { id: "e2", source: "scene:s1:frame", target: "scene:s1:video" },
    { id: "e3", source: "scene:s1:video", target: "assembly" },
    { id: "e4", source: "assembly", target: "output" },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("canvas graph helpers", () => {
  it("round-trips through React Flow nodes", () => {
    const nodes = toFlowNodes(payload, new Set(["assembly"]));
    expect(nodes.find((n) => n.id === "assembly")?.selected).toBe(true);
    const back = fromFlow(nodes, toFlowEdges(payload));
    expect(back.nodes).toEqual(payload.nodes);
    expect(back.edges).toEqual(payload.edges);
  });

  it("«Собрать всё» takes only runnable nodes feeding the output", () => {
    expect(runnableAncestors(payload).sort()).toEqual(["assembly", "scene:s1:frame", "scene:s1:video"]);
  });
});
