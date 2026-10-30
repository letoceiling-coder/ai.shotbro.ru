import type { Edge, Node } from "@xyflow/react";
import {
  CANVAS_OUTPUT_NODE_ID,
  isRunnableCanvasKind,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeData,
  type CanvasNodeKind,
  type CanvasNodeRun,
  type CanvasPortType,
  type SceneCanvasPayload,
} from "@shotbro/contracts";

export type FlowNodeData = {
  kind: CanvasNodeKind;
  sceneId?: string;
  data: CanvasNodeData;
};
export type FlowNode = Node<FlowNodeData, "canvasNode">;

export const PORT_COLOUR: Record<CanvasPortType, string> = {
  text: "#94a3b8",
  image: "#38bdf8",
  video: "#a78bfa",
  audio: "#34d399",
  avatar: "#f472b6",
  voice: "#fbbf24",
  character: "#fb7185",
};

export function toFlowNodes(payload: SceneCanvasPayload, selected: Set<string>): FlowNode[] {
  return payload.nodes.map((n) => ({
    id: n.id,
    type: "canvasNode" as const,
    position: n.position,
    selected: selected.has(n.id),
    data: { kind: n.kind, sceneId: n.sceneId, data: n.data ?? {} },
  }));
}

export function toFlowEdges(payload: SceneCanvasPayload): Edge[] {
  return payload.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

export function fromFlow(nodes: FlowNode[], edges: Edge[]): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      ...(n.data.sceneId ? { sceneId: n.data.sceneId } : {}),
      data: n.data.data ?? {},
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

/** «Собрать всё»: every runnable node that feeds the output (directly or through other nodes). */
export function runnableAncestors(payload: Pick<SceneCanvasPayload, "nodes" | "edges">, rootId = CANVAS_OUTPUT_NODE_ID): string[] {
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

export type NodeRunState = "none" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export function latestRunState(runs: CanvasNodeRun[] | undefined): NodeRunState {
  return runs?.[0]?.status ?? "none";
}

export const RUN_STATE_LABEL: Record<NodeRunState, string> = {
  none: "Нет результата",
  QUEUED: "В очереди",
  RUNNING: "Выполняется",
  COMPLETED: "Готово",
  FAILED: "Ошибка",
};

const FAILURE_LABEL: Record<string, string> = {
  APPROVAL_REQUIRED: "нет подтверждения стоимости",
  LIVE_BLOCKED: "реальные генерации выключены",
  UPSTREAM_FAILED: "не выполнился предыдущий узел",
  INPUT_MISSING: "нет входных данных",
  ASSET_NOT_ACCESSIBLE: "файл недоступен",
};

export function failureLabel(code: string | null) {
  if (!code) return "ошибка";
  return FAILURE_LABEL[code] ?? code;
}

let seq = 0;
export function newNodeId(kind: CanvasNodeKind) {
  seq += 1;
  return `${kind}-${Date.now().toString(36)}-${seq}`;
}
