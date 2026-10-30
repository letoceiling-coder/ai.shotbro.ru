import {
  CANVAS_ASSEMBLY_NODE_ID,
  CANVAS_OUTPUT_NODE_ID,
  isRunnableCanvasKind,
  sceneCanvasNodeId,
  type CanvasEdge,
  type CanvasNode,
  type SceneCanvasPayload,
} from "@shotbro/contracts";

export type CanvasSceneLite = {
  sceneId: string;
  order: number;
  title: string;
  durationSeconds: number;
  firstFramePrompt?: string;
  description?: string;
  videoMotionPrompt?: string;
  narration?: string;
};

const COL = { prompt: 0, frame: 340, video: 680, assembly: 1060, output: 1380 };
const ROW = 230;

export const edgeId = (source: string, target: string) => `e:${source}->${target}`;

function edge(source: string, target: string): CanvasEdge {
  return { id: edgeId(source, target), source, target };
}

export function emptyCanvasPayload(): SceneCanvasPayload {
  return {
    schemaVersion: 1,
    nodes: [
      { id: CANVAS_ASSEMBLY_NODE_ID, kind: "assembly", position: { x: COL.assembly, y: 0 }, data: {} },
      { id: CANVAS_OUTPUT_NODE_ID, kind: "output", position: { x: COL.output, y: 0 }, data: {} },
    ],
    edges: [edge(CANVAS_ASSEMBLY_NODE_ID, CANVAS_OUTPUT_NODE_ID)],
    viewport: { x: 40, y: 40, zoom: 0.75 },
  };
}

/**
 * Adds the standard chain «промпт → первый кадр → видео сцены → монтаж» for every storyboard scene
 * that has no nodes yet. Existing nodes (moved, edited or rewired by the user) are never touched,
 * and nodes of scenes removed from the storyboard are kept and reported as orphans.
 */
export function syncCanvasWithStoryboard(
  current: SceneCanvasPayload | null,
  scenes: CanvasSceneLite[],
): { payload: SceneCanvasPayload; changed: boolean; addedSceneIds: string[]; orphanSceneIds: string[] } {
  const base = current ?? emptyCanvasPayload();
  const nodes: CanvasNode[] = [...base.nodes];
  const edges: CanvasEdge[] = [...base.edges];
  const ids = new Set(nodes.map((n) => n.id));
  const edgeIds = new Set(edges.map((e) => e.id));
  const addEdge = (s: string, t: string) => {
    const e = edge(s, t);
    if (!edgeIds.has(e.id) && ids.has(s) && ids.has(t)) {
      edges.push(e);
      edgeIds.add(e.id);
    }
  };
  let changed = current === null;

  if (!ids.has(CANVAS_ASSEMBLY_NODE_ID)) {
    nodes.push({ id: CANVAS_ASSEMBLY_NODE_ID, kind: "assembly", position: { x: COL.assembly, y: 0 }, data: {} });
    ids.add(CANVAS_ASSEMBLY_NODE_ID);
    changed = true;
  }

  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const addedSceneIds: string[] = [];
  sorted.forEach((scene, i) => {
    const promptId = sceneCanvasNodeId(scene.sceneId, "prompt");
    const frameId = sceneCanvasNodeId(scene.sceneId, "frame");
    const videoId = sceneCanvasNodeId(scene.sceneId, "video");
    if (nodes.some((n) => n.sceneId === scene.sceneId)) return;
    const y = i * ROW;
    nodes.push(
      { id: promptId, kind: "prompt", sceneId: scene.sceneId, position: { x: COL.prompt, y }, data: {} },
      { id: frameId, kind: "first_frame", sceneId: scene.sceneId, position: { x: COL.frame, y }, data: {} },
      {
        id: videoId,
        kind: "scene_video",
        sceneId: scene.sceneId,
        position: { x: COL.video, y },
        data: { durationSeconds: Math.min(10, Math.max(1, scene.durationSeconds)) },
      },
    );
    ids.add(promptId);
    ids.add(frameId);
    ids.add(videoId);
    addEdge(promptId, frameId);
    addEdge(frameId, videoId);
    addEdge(videoId, CANVAS_ASSEMBLY_NODE_ID);
    addedSceneIds.push(scene.sceneId);
    changed = true;
  });

  const known = new Set(scenes.map((s) => s.sceneId));
  const orphanSceneIds = [...new Set(nodes.filter((n) => n.sceneId && !known.has(n.sceneId)).map((n) => n.sceneId!))];

  return {
    payload: { schemaVersion: 1, nodes, edges, viewport: base.viewport },
    changed,
    addedSceneIds,
    orphanSceneIds,
  };
}

/** «Собрать всё»: every runnable node that feeds the output node (directly or through other nodes). */
export function canvasRunAllNodeIds(payload: Pick<SceneCanvasPayload, "nodes" | "edges">, rootId = CANVAS_OUTPUT_NODE_ID): string[] {
  const kinds = new Map(payload.nodes.map((n) => [n.id, n.kind]));
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of payload.edges) {
      if (e.target === id && !seen.has(e.source)) {
        seen.add(e.source);
        stack.push(e.source);
      }
    }
  }
  return [...seen].filter((id) => isRunnableCanvasKind(kinds.get(id) ?? ""));
}
