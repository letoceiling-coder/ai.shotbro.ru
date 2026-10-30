import { describe, expect, it } from "vitest";
import type { AppEnv } from "@shotbro/config/env";
import { canConnectCanvasNodes, sceneCanvasNodeId, type SceneCanvasPayload } from "@shotbro/contracts";
import { syncCanvasWithStoryboard } from "./canvas-sync.js";
import { buildCanvasRunPlan } from "./canvas-run-plan.js";
import { canvasApprovalPayload, quoteCanvasNode } from "./canvas-price-catalog.js";

const scenes = [
  { sceneId: "s1", order: 1, title: "Открытие", durationSeconds: 4, firstFramePrompt: "Логотип ShotBro" },
  { sceneId: "s2", order: 2, title: "Финал", durationSeconds: 30, firstFramePrompt: "Призыв на сайт", videoMotionPrompt: "наезд" },
];

const mockEnv = { AI_MOCK_MODE: true, OPENROUTER_ENABLED: true, OPENROUTER_API_KEY: "k" } as unknown as AppEnv;
const liveEnv = { ...mockEnv, AI_MOCK_MODE: false } as AppEnv;

describe("canvas sync with storyboard", () => {
  it("builds prompt → frame → video → assembly per scene", () => {
    const r = syncCanvasWithStoryboard(null, scenes);
    expect(r.changed).toBe(true);
    expect(r.addedSceneIds).toEqual(["s1", "s2"]);
    const ids = r.payload.nodes.map((n) => n.id);
    expect(ids).toContain(sceneCanvasNodeId("s1", "frame"));
    expect(r.payload.edges.map((e) => e.id)).toContain(`e:${sceneCanvasNodeId("s2", "video")}->assembly`);
    // durations are capped at 10 s (customer limit for real tests)
    expect(r.payload.nodes.find((n) => n.id === sceneCanvasNodeId("s2", "video"))?.data.durationSeconds).toBe(10);
  });

  it("is idempotent and keeps user changes and orphans", () => {
    const first = syncCanvasWithStoryboard(null, scenes).payload;
    const moved: SceneCanvasPayload = {
      ...first,
      nodes: first.nodes.map((n) => (n.id === sceneCanvasNodeId("s1", "frame") ? { ...n, position: { x: 5, y: 5 } } : n)),
      edges: first.edges.filter((e) => e.id !== `e:${sceneCanvasNodeId("s1", "video")}->assembly`),
    };
    const again = syncCanvasWithStoryboard(moved, scenes);
    expect(again.changed).toBe(false);
    expect(again.payload.nodes.find((n) => n.id === sceneCanvasNodeId("s1", "frame"))?.position).toEqual({ x: 5, y: 5 });
    expect(again.payload.edges.some((e) => e.id === `e:${sceneCanvasNodeId("s1", "video")}->assembly`)).toBe(false);

    const removed = syncCanvasWithStoryboard(moved, [scenes[1]!]);
    expect(removed.orphanSceneIds).toEqual(["s1"]);
    expect(removed.payload.nodes.some((n) => n.sceneId === "s1")).toBe(true);
  });
});

describe("canvas connection rules", () => {
  it("allows typed ports only", () => {
    expect(canConnectCanvasNodes({ kind: "first_frame", data: {} }, { kind: "scene_video", data: {} })).toBe(true);
    expect(canConnectCanvasNodes({ kind: "scene_video", data: {} }, { kind: "first_frame", data: {} })).toBe(false);
    expect(canConnectCanvasNodes({ kind: "asset", data: { mediaType: "video" } }, { kind: "assembly", data: {} })).toBe(true);
    expect(canConnectCanvasNodes({ kind: "character", data: {} }, { kind: "avatar_video", data: {} })).toBe(true);
    expect(canConnectCanvasNodes({ kind: "output", data: {} }, { kind: "assembly", data: {} })).toBe(false);
  });
});

describe("canvas run plan", () => {
  const payload = syncCanvasWithStoryboard(null, scenes).payload;

  it("orders the whole graph topologically", () => {
    const all = payload.nodes.filter((n) => ["first_frame", "scene_video", "assembly"].includes(n.kind)).map((n) => n.id);
    const plan = buildCanvasRunPlan({ payload, scenes, nodeIds: [...all].reverse(), latestAssetByNode: new Map() });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const order = plan.steps.map((s) => s.nodeId);
    expect(order.indexOf(sceneCanvasNodeId("s1", "frame"))).toBeLessThan(order.indexOf(sceneCanvasNodeId("s1", "video")));
    expect(order.at(-1)).toBe("assembly");
    expect(plan.steps.find((s) => s.nodeId === sceneCanvasNodeId("s1", "frame"))?.text).toBe("Логотип ShotBro");
    expect(plan.steps.find((s) => s.nodeId === sceneCanvasNodeId("s2", "video"))?.text).toBe("наезд");
  });

  it("asks to run the upstream node first", () => {
    const plan = buildCanvasRunPlan({ payload, scenes, nodeIds: [sceneCanvasNodeId("s1", "video")], latestAssetByNode: new Map() });
    expect(plan).toMatchObject({ ok: false, error: { code: "upstream_not_ready", nodeId: sceneCanvasNodeId("s1", "frame") } });
  });

  it("re-runs one scene using the previous frame result", () => {
    const latest = new Map([[sceneCanvasNodeId("s1", "frame"), "asset-1"]]);
    const plan = buildCanvasRunPlan({ payload, scenes, nodeIds: [sceneCanvasNodeId("s1", "video")], latestAssetByNode: latest });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.steps[0]!.inputs[0]).toMatchObject({ assetId: "asset-1", inPlan: false, type: "image" });
  });

  it("changes the spec hash when the storyboard prompt changes", () => {
    const id = sceneCanvasNodeId("s1", "frame");
    const a = buildCanvasRunPlan({ payload, scenes, nodeIds: [id], latestAssetByNode: new Map() });
    const edited = [{ ...scenes[0]!, firstFramePrompt: "Другой промпт" }, scenes[1]!];
    const b = buildCanvasRunPlan({ payload, scenes: edited, nodeIds: [id], latestAssetByNode: new Map() });
    expect(a.ok && b.ok && a.steps[0]!.specHash !== b.steps[0]!.specHash).toBe(true);
  });

  it("rejects non-runnable nodes and cycles", () => {
    expect(buildCanvasRunPlan({ payload, scenes, nodeIds: ["output"], latestAssetByNode: new Map() })).toMatchObject({
      ok: false,
      error: { code: "node_not_runnable" },
    });
    const cyc: SceneCanvasPayload = {
      ...payload,
      nodes: [
        { id: "u1", kind: "upscale", position: { x: 0, y: 0 }, data: {} },
        { id: "u2", kind: "upscale", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: "a", source: "u1", target: "u2" },
        { id: "b", source: "u2", target: "u1" },
      ],
    };
    expect(buildCanvasRunPlan({ payload: cyc, scenes, nodeIds: ["u1", "u2"], latestAssetByNode: new Map() })).toMatchObject({
      ok: false,
      error: { code: "cycle" },
    });
  });

  it("avatar video needs an avatar and text", () => {
    const p: SceneCanvasPayload = {
      ...payload,
      nodes: [
        { id: "av", kind: "avatar", position: { x: 0, y: 0 }, data: { avatarProfileId: "a1" } },
        { id: "t", kind: "prompt", position: { x: 0, y: 0 }, data: { text: "Привет, это ShotBro" } },
        { id: "v", kind: "avatar_video", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: "e1", source: "av", target: "v" }],
    };
    expect(buildCanvasRunPlan({ payload: p, scenes, nodeIds: ["v"], latestAssetByNode: new Map() })).toMatchObject({
      ok: false,
      error: { code: "missing_text" },
    });
    const ok = buildCanvasRunPlan({
      payload: { ...p, edges: [...p.edges, { id: "e2", source: "t", target: "v" }] },
      scenes,
      nodeIds: ["v"],
      latestAssetByNode: new Map(),
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.steps[0]!.inputs.find((i) => i.type === "avatar")?.avatarProfileId).toBe("a1");
  });
});

describe("canvas prices", () => {
  it("charges $0 in mock mode but shows the live estimate", () => {
    const q = quoteCanvasNode(mockEnv, { kind: "scene_video", durationSeconds: 5 });
    expect(q).toMatchObject({ chargedUsd: 0, estimatedLiveUsd: 0.4, mock: true });
    expect(q.providerId.startsWith("mock-")).toBe(true);
    expect(quoteCanvasNode(liveEnv, { kind: "scene_video", durationSeconds: 30 }).chargedUsd).toBe(0.8);
    expect(quoteCanvasNode(liveEnv, { kind: "assembly" })).toMatchObject({ chargedUsd: 0, providerId: "local-ffmpeg" });
  });

  it("approval payload totals the items", () => {
    const p = canvasApprovalPayload({
      canvasId: "c",
      items: [
        { nodeId: "a", kind: "first_frame", specHash: "h1", chargedUsd: 0.04 },
        { nodeId: "b", kind: "scene_video", specHash: "h2", chargedUsd: 0.4 },
      ],
    });
    expect(p.totalChargedUsd).toBe(0.44);
    expect(Object.keys(p)).toEqual(["kind", "canvasId", "items", "totalChargedUsd"]);
  });
});
