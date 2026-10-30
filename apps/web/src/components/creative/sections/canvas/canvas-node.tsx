"use client";

import { createContext, memo, useContext, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CANVAS_NODE_LABEL,
  CANVAS_NODE_PORTS,
  canvasOutputType,
  isRunnableCanvasKind,
  type CanvasNodeData,
  type CanvasNodeRun,
  type SceneCanvasView,
} from "@shotbro/contracts";
import { Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAssetMediaUrl } from "@/hooks/use-asset-media-url";
import { useCharacters, usePatchStoryboardScene, useProjectAssets } from "@/hooks/use-creative-studio";
import { useAvatars, useVoices } from "@/hooks/use-talent";
import { canvasKey } from "@/hooks/use-canvas";
import { talentErrorMessage } from "@/lib/talent-errors";
import { cn } from "@/lib/utils";
import { PORT_COLOUR, RUN_STATE_LABEL, failureLabel, latestRunState, type FlowNode } from "./canvas-graph";

export type CanvasCtx = {
  projectId: string;
  view: SceneCanvasView;
  pendingNodeIds: Set<string>;
  runNodes: (nodeIds: string[]) => void;
  updateNodeData: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
};

export const CanvasContext = createContext<CanvasCtx | null>(null);

function useCanvasCtx() {
  const c = useContext(CanvasContext);
  if (!c) throw new Error("CanvasContext missing");
  return c;
}

const STATE_VARIANT = {
  none: "outline",
  QUEUED: "secondary",
  RUNNING: "secondary",
  COMPLETED: "success",
  FAILED: "demo",
} as const;

function RunPreview({ run, testId }: { run: CanvasNodeRun; testId: string }) {
  const media = useAssetMediaUrl(run.assetId ?? undefined);
  const src = media.data?.url;
  if (!run.assetId) return null;
  if (!src) return <div className="h-24 animate-pulse rounded bg-muted" data-testid={testId} data-state="loading" />;
  const mime = run.mimeType ?? "";
  if (mime.startsWith("video/")) {
    return <video src={src} controls muted playsInline className="nodrag max-h-40 w-full rounded bg-black" data-testid={testId} data-asset-id={run.assetId} />;
  }
  if (mime.startsWith("audio/")) {
    return <audio src={src} controls className="nodrag w-full" data-testid={testId} data-asset-id={run.assetId} />;
  }
  return <img src={src} alt="Результат узла" className="max-h-40 w-full rounded object-contain" data-testid={testId} data-asset-id={run.assetId} />;
}

/** Text of a scene prompt node lives in the storyboard: edits are saved there (single source of truth). */
function ScenePromptEditor({ sceneId, testId }: { sceneId: string; testId: string }) {
  const { projectId, view } = useCanvasCtx();
  const scene = view.scenes.find((s) => s.sceneId === sceneId);
  const patch = usePatchStoryboardScene(projectId);
  const qc = useQueryClient();
  const [text, setText] = useState(scene?.firstFramePrompt ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(scene?.firstFramePrompt ?? ""), [scene?.firstFramePrompt]);
  if (!scene) return <p className="text-xs text-[var(--sb-warning)]">Сцена удалена из раскадровки</p>;
  return (
    <div className="space-y-1">
      <textarea
        className="nodrag nowheel min-h-[72px] w-full resize-y rounded border border-border bg-background p-1.5 text-xs"
        value={text}
        maxLength={2500}
        data-testid={`${testId}-text`}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          if (text === (scene.firstFramePrompt ?? "")) return;
          setError(null);
          try {
            await patch.mutateAsync({ sceneId, patch: { firstFramePrompt: text, expectedRevision: scene.revision } });
            await qc.invalidateQueries({ queryKey: canvasKey(projectId) });
          } catch (e) {
            setError(talentErrorMessage(e));
          }
        }}
      />
      <p className="text-[10px] text-muted-foreground">{patch.isPending ? "Сохраняю в раскадровку…" : "Сохраняется в раскадровку"}</p>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}

function NodeFields({ id, kind, sceneId, data, testId }: { id: string; kind: FlowNode["data"]["kind"]; sceneId?: string; data: CanvasNodeData; testId: string }) {
  const { projectId, updateNodeData } = useCanvasCtx();
  const assets = useProjectAssets(kind === "asset" ? projectId : undefined);
  const characters = useCharacters(kind === "character" ? projectId : undefined);
  const avatars = useAvatars();
  const voices = useVoices();
  const selectCls = "nodrag w-full rounded border border-border bg-background p-1 text-xs";

  if (kind === "prompt") {
    if (sceneId) return <ScenePromptEditor sceneId={sceneId} testId={testId} />;
    return (
      <textarea
        className="nodrag nowheel min-h-[72px] w-full resize-y rounded border border-border bg-background p-1.5 text-xs"
        value={data.text ?? ""}
        maxLength={2500}
        placeholder="Текст промпта или реплики"
        data-testid={`${testId}-text`}
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
      />
    );
  }
  if (kind === "asset") {
    const items = (assets.data ?? []).filter((a) => a.status === "READY" && /^(image|video|audio)\//.test(a.mimeType));
    return (
      <select
        className={selectCls}
        value={data.assetId ?? ""}
        data-testid={`${testId}-asset`}
        onChange={(e) => {
          const a = items.find((x) => x.id === e.target.value);
          const mediaType = a?.mimeType.split("/")[0] as CanvasNodeData["mediaType"];
          updateNodeData(id, { assetId: a?.id, mediaType });
        }}
      >
        <option value="">— выберите файл —</option>
        {items.map((a) => (
          <option key={a.id} value={a.id}>
            {a.originalName ?? a.id.slice(0, 8)}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "character") {
    return (
      <select className={selectCls} value={data.characterId ?? ""} data-testid={`${testId}-character`} onChange={(e) => updateNodeData(id, { characterId: e.target.value || undefined })}>
        <option value="">— персонаж —</option>
        {(characters.data?.items ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "avatar") {
    const list = (avatars.data?.items ?? []).filter((a) => a.status === "READY");
    const current = list.find((a) => a.id === data.avatarProfileId);
    return (
      <div className="space-y-1">
        <select className={selectCls} value={data.avatarProfileId ?? ""} data-testid={`${testId}-avatar`} onChange={(e) => updateNodeData(id, { avatarProfileId: e.target.value || undefined, avatarLookId: undefined })}>
          <option value="">— готовый аватар —</option>
          {list.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {current && current.looks.length > 1 ? (
          <select className={selectCls} value={data.avatarLookId ?? ""} data-testid={`${testId}-look`} onChange={(e) => updateNodeData(id, { avatarLookId: e.target.value || undefined })}>
            <option value="">Образ по умолчанию</option>
            {current.looks.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label ?? l.id.slice(0, 6)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }
  if (kind === "voice") {
    const list = (voices.data?.items ?? []).filter((v) => v.status === "READY");
    return (
      <select className={selectCls} value={data.voiceProfileId ?? ""} data-testid={`${testId}-voice`} onChange={(e) => updateNodeData(id, { voiceProfileId: e.target.value || undefined })}>
        <option value="">— готовый голос —</option>
        {list.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "scene_video" || kind === "avatar_video") {
    return (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Длительность, с
        <input
          type="number"
          min={1}
          max={10}
          className="nodrag w-16 rounded border border-border bg-background p-1 text-xs"
          value={data.durationSeconds ?? 5}
          data-testid={`${testId}-duration`}
          onChange={(e) => {
            const v = Math.min(10, Math.max(1, Number(e.target.value) || 5));
            updateNodeData(id, { durationSeconds: v });
          }}
        />
      </label>
    );
  }
  return null;
}

function CanvasNodeCardImpl({ id, data, selected }: NodeProps<FlowNode>) {
  const { view, pendingNodeIds, runNodes } = useCanvasCtx();
  const { kind, sceneId } = data;
  const testId = `canvas-node-${id}`;
  const runs = view.runs[id] ?? [];
  const state = latestRunState(runs);
  const completed = runs.filter((r) => r.status === "COMPLETED" && r.assetId);
  const [pick, setPick] = useState<string | null>(null);
  const shown = completed.find((r) => r.id === pick) ?? completed[0];
  const scene = sceneId ? view.scenes.find((s) => s.sceneId === sceneId) : undefined;
  const ports = CANVAS_NODE_PORTS[kind];
  const out = canvasOutputType({ kind, data: data.data });
  const runnable = isRunnableCanvasKind(kind);
  const busy = state === "QUEUED" || state === "RUNNING";
  const outputRuns = kind === "output" ? (view.runs["assembly"] ?? []).filter((r) => r.status === "COMPLETED" && r.assetId) : [];

  return (
    <div
      className={cn(
        "w-[260px] rounded-xl border bg-card text-card-foreground shadow-sm",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
      data-testid={testId}
      data-kind={kind}
      data-status={state}
    >
      {ports.accepts.length ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-background"
          style={{ background: PORT_COLOUR[ports.accepts[0]!] }}
          title={`Вход: ${ports.accepts.join(", ")}`}
        />
      ) : null}
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{CANVAS_NODE_LABEL[kind]}</p>
          {scene ? (
            <p className="truncate text-[11px] text-muted-foreground" title={scene.title}>
              Сцена {scene.order} · {scene.title}
            </p>
          ) : sceneId ? (
            <p className="text-[11px] text-[var(--sb-warning)]">Сцена удалена</p>
          ) : null}
        </div>
        {runnable ? (
          <Badge variant={STATE_VARIANT[state]} className="shrink-0 text-[10px]" data-testid={`${testId}-status`}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {RUN_STATE_LABEL[state]}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-2 px-3 py-2">
        <NodeFields id={id} kind={kind} sceneId={sceneId} data={data.data} testId={testId} />
        {state === "FAILED" ? (
          <p className="text-[11px] text-destructive" data-testid={`${testId}-failure`}>
            Причина: {failureLabel(runs[0]?.failureCode ?? null)}
          </p>
        ) : null}
        {shown ? <RunPreview run={shown} testId={`${testId}-preview`} /> : null}
        {kind === "output" ? (
          outputRuns[0] ? (
            <RunPreview run={outputRuns[0]} testId={`${testId}-preview`} />
          ) : (
            <p className="text-[11px] text-muted-foreground">Здесь появится готовый ролик после монтажа</p>
          )
        ) : null}
        {completed.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1" data-testid={`${testId}-versions`} data-count={completed.length}>
            <span className="text-[10px] text-muted-foreground">Версии:</span>
            {completed.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className={cn(
                  "nodrag rounded border px-1.5 text-[10px]",
                  (shown?.id ?? completed[0]?.id) === r.id ? "border-primary text-primary" : "border-border text-muted-foreground",
                )}
                onClick={() => setPick(r.id)}
                title={new Date(r.createdAt).toLocaleString("ru-RU")}
              >
                v{completed.length - i}
              </button>
            ))}
          </div>
        ) : completed.length === 1 ? (
          <span className="hidden" data-testid={`${testId}-versions`} data-count={1} />
        ) : null}
        {runnable ? (
          <Button
            size="sm"
            variant={state === "COMPLETED" ? "outline" : "default"}
            className="nodrag h-7 w-full text-xs"
            disabled={busy || pendingNodeIds.size > 0}
            data-testid={`${testId}-run`}
            onClick={() => runNodes([id])}
          >
            <Play className="mr-1 h-3 w-3" />
            {state === "COMPLETED" ? "Перезапустить — узнать цену" : "Запустить — узнать цену"}
          </Button>
        ) : null}
      </div>
      {out ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-background"
          style={{ background: PORT_COLOUR[out] }}
          title={`Выход: ${out}`}
        />
      ) : null}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardImpl);
