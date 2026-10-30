import { createHash } from "node:crypto";
import {
  canConnectCanvasNodes,
  canvasOutputType,
  isRunnableCanvasKind,
  type CanvasNode,
  type CanvasPortType,
  type RunnableCanvasKind,
  type SceneCanvasPayload,
} from "@shotbro/contracts";
import type { CanvasSceneLite } from "./canvas-sync.js";

export type CanvasStepInput = {
  nodeId: string;
  kind: CanvasNode["kind"];
  type: CanvasPortType;
  /** Upstream node also runs in this plan (its output is known only at execution time). */
  inPlan: boolean;
  /** Asset node or the latest completed run of an upstream runnable node. */
  assetId: string | null;
  text?: string;
  characterId?: string;
  avatarProfileId?: string;
  avatarLookId?: string;
  voiceProfileId?: string;
};

export type CanvasRunStep = {
  nodeId: string;
  kind: RunnableCanvasKind;
  sceneId: string | null;
  durationSeconds: number;
  /** Text that drives the node (prompt / motion prompt / narration). */
  text: string;
  inputs: CanvasStepInput[];
  specHash: string;
};

export type CanvasPlanError = { code: string; nodeId?: string; message: string };

export type CanvasRunPlan = { ok: true; steps: CanvasRunStep[] } | { ok: false; error: CanvasPlanError };

/** Text a prompt node carries: scene prompt nodes read the storyboard, user nodes their own text. */
export function canvasPromptText(node: CanvasNode, scenes: Map<string, CanvasSceneLite>): string {
  if (node.sceneId) {
    const s = scenes.get(node.sceneId);
    return (s?.firstFramePrompt || s?.description || s?.title || "").trim();
  }
  return (node.data?.text ?? "").trim();
}

function stepText(node: CanvasNode, inputs: CanvasStepInput[], scenes: Map<string, CanvasSceneLite>) {
  const fromInputs = inputs
    .filter((i) => i.type === "text" && i.text)
    .map((i) => i.text!)
    .join("\n");
  const scene = node.sceneId ? scenes.get(node.sceneId) : undefined;
  if (node.kind === "scene_video") return (scene?.videoMotionPrompt || fromInputs || scene?.description || "").trim();
  if (node.kind === "tts") return (fromInputs || scene?.narration || "").trim();
  return fromInputs.trim();
}

const err = (code: string, message: string, nodeId?: string): CanvasRunPlan => ({ ok: false, error: { code, message, nodeId } });

/**
 * Validates a run request and orders it topologically. Every runnable upstream input must either
 * run in the same plan or already have a completed result — otherwise the user is told which node
 * to run first. Nothing here touches providers or money.
 */
export function buildCanvasRunPlan(input: {
  payload: SceneCanvasPayload;
  scenes: CanvasSceneLite[];
  nodeIds: string[];
  /** Latest completed output asset per runnable node. */
  latestAssetByNode: Map<string, string>;
}): CanvasRunPlan {
  const byId = new Map(input.payload.nodes.map((n) => [n.id, n]));
  const scenes = new Map(input.scenes.map((s) => [s.sceneId, s]));
  const selected = [...new Set(input.nodeIds)];

  for (const id of selected) {
    const n = byId.get(id);
    if (!n) return err("node_not_found", `Узел ${id} не найден`, id);
    if (!isRunnableCanvasKind(n.kind)) return err("node_not_runnable", "Этот узел нельзя запустить", id);
    if (n.sceneId && !scenes.has(n.sceneId)) return err("scene_removed", "Сцена удалена из раскадровки", id);
  }
  const inPlan = new Set(selected);

  const incoming = (id: string) => input.payload.edges.filter((e) => e.target === id);

  // Topological order of the selected nodes (dependencies among them first).
  const ordered: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string): CanvasPlanError | null => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "visiting") return { code: "cycle", message: "В схеме есть цикл", nodeId: id };
    state.set(id, "visiting");
    for (const e of incoming(id)) {
      if (inPlan.has(e.source)) {
        const r = visit(e.source);
        if (r) return r;
      }
    }
    state.set(id, "done");
    ordered.push(id);
    return null;
  };
  for (const id of selected) {
    const r = visit(id);
    if (r) return { ok: false, error: r };
  }

  const steps: CanvasRunStep[] = [];
  for (const id of ordered) {
    const node = byId.get(id)!;
    const inputs: CanvasStepInput[] = [];
    for (const e of incoming(id)) {
      const src = byId.get(e.source);
      if (!src) continue;
      if (!canConnectCanvasNodes(src, node)) return err("invalid_connection", "Несовместимое соединение", id);
      const type = canvasOutputType(src)!;
      const runnable = isRunnableCanvasKind(src.kind);
      const latest = runnable ? (input.latestAssetByNode.get(src.id) ?? null) : null;
      if (runnable && !inPlan.has(src.id) && !latest) {
        return err("upstream_not_ready", "Сначала запустите предыдущий узел", src.id);
      }
      inputs.push({
        nodeId: src.id,
        kind: src.kind,
        type,
        inPlan: runnable && inPlan.has(src.id),
        assetId: src.kind === "asset" ? (src.data?.assetId ?? null) : latest,
        ...(src.kind === "prompt" ? { text: canvasPromptText(src, scenes) } : {}),
        ...(src.data?.characterId ? { characterId: src.data.characterId } : {}),
        ...(src.data?.avatarProfileId ? { avatarProfileId: src.data.avatarProfileId } : {}),
        ...(src.data?.avatarLookId ? { avatarLookId: src.data.avatarLookId } : {}),
        ...(src.data?.voiceProfileId ? { voiceProfileId: src.data.voiceProfileId } : {}),
      });
    }
    inputs.sort((a, b) => a.nodeId.localeCompare(b.nodeId));

    const has = (t: CanvasPortType) => inputs.some((i) => i.type === t);
    const assetMissing = inputs.find((i) => i.kind === "asset" && !i.assetId);
    if (assetMissing) return err("asset_missing", "В узле «Материал» не выбран файл", assetMissing.nodeId);
    const text = stepText(node, inputs, scenes);
    const kind = node.kind as RunnableCanvasKind;
    if (kind === "first_frame" && !text && !has("image")) return err("missing_prompt", "Нужен текст промпта", id);
    if (kind === "scene_video" && !has("image")) return err("missing_image", "Подключите первый кадр или изображение", id);
    if (kind === "upscale" && !has("image")) return err("missing_image", "Подключите изображение", id);
    if (kind === "assembly" && !has("video")) return err("missing_video", "Подключите хотя бы одно видео", id);
    if (kind === "tts") {
      if (!text) return err("missing_text", "Нужен текст для озвучки", id);
      if (!has("voice") && !has("character")) return err("missing_voice", "Подключите голос или персонажа", id);
    }
    if (kind === "avatar_video") {
      if (!has("avatar") && !has("character")) return err("missing_avatar", "Подключите аватар или персонажа", id);
      if (!text && !has("audio")) return err("missing_text", "Нужен текст или озвучка", id);
    }

    const scene = node.sceneId ? scenes.get(node.sceneId) : undefined;
    const durationSeconds = Math.min(10, Math.max(1, node.data?.durationSeconds ?? scene?.durationSeconds ?? 5));
    const spec = {
      kind,
      sceneId: node.sceneId ?? null,
      durationSeconds,
      text,
      inputs: inputs.map((i) => ({ nodeId: i.nodeId, type: i.type, assetId: i.inPlan ? "<run>" : i.assetId, text: i.text ?? null })),
      data: node.data ?? {},
    };
    steps.push({
      nodeId: id,
      kind,
      sceneId: node.sceneId ?? null,
      durationSeconds,
      text,
      inputs,
      specHash: createHash("sha256").update(JSON.stringify(spec)).digest("hex"),
    });
  }
  return { ok: true, steps };
}
