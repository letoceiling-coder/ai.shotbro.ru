"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Viewport,
} from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  CANVAS_NODE_LABEL,
  canConnectCanvasNodes,
  type CanvasNodeData,
  type CanvasNodeKind,
  type CanvasQuoteResult,
  type SceneCanvasView,
} from "@shotbro/contracts";
import { Check, Clapperboard, Loader2, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canvasKey,
  useCanvas,
  useConfirmCanvasQuote,
  useQuoteCanvas,
  useRejectCanvasQuote,
  useSaveCanvas,
} from "@/hooks/use-canvas";
import { ApiError } from "@/lib/api-client";
import { talentErrorMessage } from "@/lib/talent-errors";
import { CanvasContext, CanvasNodeCard, type CanvasCtx } from "./canvas-node";
import { fromFlow, newNodeId, runnableAncestors, toFlowEdges, toFlowNodes, type FlowNode } from "./canvas-graph";

const nodeTypes = { canvasNode: CanvasNodeCard };

const ADDABLE: CanvasNodeKind[] = [
  "prompt",
  "asset",
  "character",
  "avatar",
  "voice",
  "first_frame",
  "scene_video",
  "avatar_video",
  "tts",
  "upscale",
];

type SaveState = "saved" | "dirty" | "saving" | "error";

const selKey = (projectId: string) => `shotbro-canvas-selection:${projectId}`;

function readSelection(projectId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(selKey(projectId)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeSelection(projectId: string, ids: string[]) {
  try {
    localStorage.setItem(selKey(projectId), JSON.stringify(ids));
  } catch {
    /* storage unavailable: selection just isn't restored */
  }
}

function QuoteCard({
  quote,
  onApprove,
  onCancel,
  busy,
}: {
  quote: CanvasQuoteResult;
  onApprove: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-primary/40 bg-card p-3 shadow-lg" data-testid="canvas-quote">
      <p className="text-sm font-semibold">
        {quote.items.length === 1 ? `Запуск узла «${CANVAS_NODE_LABEL[quote.items[0]!.kind]}»` : `Запуск ${quote.items.length} узлов`}
      </p>
      <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto text-xs text-muted-foreground">
        {quote.items.map((i) => (
          <li key={i.nodeId}>
            {CANVAS_NODE_LABEL[i.kind]} · {i.providerId} · ≈ ${i.estimatedLiveUsd.toFixed(2)}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold" data-testid="canvas-quote-total">
          Итого ≈ ${quote.totalEstimatedLiveUsd.toFixed(2)}
        </span>
        {quote.mock ? (
          <Badge variant="demo" data-testid="canvas-quote-mock">
            тест: списание $0
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Одно подтверждение на весь запуск. Та же карточка есть в чате.</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={onApprove} disabled={busy} data-testid="canvas-approve">
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
          Подтвердить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} data-testid="canvas-cancel">
          <X className="mr-1 h-3 w-3" />
          Отмена
        </Button>
      </div>
    </div>
  );
}

function CanvasEditor({ projectId, view }: { projectId: string; view: SceneCanvasView }) {
  const qc = useQueryClient();
  const { resolvedTheme } = useTheme();
  const save = useSaveCanvas(projectId);
  const quoteMut = useQuoteCanvas(projectId);
  const confirm = useConfirmCanvasQuote(projectId);
  const reject = useRejectCanvasQuote(projectId);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(view.payload, readSelection(projectId)));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(view.payload));
  const viewportRef = useRef<Viewport>(view.payload.viewport);
  const baseVersion = useRef(view.version);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<CanvasQuoteResult | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ nodes, edges });
  latest.current = { nodes, edges };

  // Server changed the canvas (new storyboard scene, another tab): adopt it unless we have unsaved edits.
  useEffect(() => {
    if (view.version === baseVersion.current || dirty.current) return;
    baseVersion.current = view.version;
    const selected = new Set(latest.current.nodes.filter((n) => n.selected).map((n) => n.id));
    setNodes(toFlowNodes(view.payload, selected));
    setEdges(toFlowEdges(view.payload));
  }, [view.version, view.payload, setNodes, setEdges]);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    const graph = fromFlow(latest.current.nodes, latest.current.edges);
    try {
      const r = await save.mutateAsync({ expectedVersion: baseVersion.current, ...graph, viewport: viewportRef.current });
      baseVersion.current = r.version;
      qc.setQueryData<SceneCanvasView>(canvasKey(projectId), (old) =>
        old ? { ...old, version: r.version, payload: { ...old.payload, ...graph, viewport: viewportRef.current } } : old,
      );
      setSaveState(dirty.current ? "dirty" : "saved");
    } catch (e) {
      if (e instanceof ApiError && e.code === "canvas_conflict") {
        setNotice(talentErrorMessage(e));
        baseVersion.current = -1; // force adopting the fresh server version
        setSaveState("saved");
        void qc.invalidateQueries({ queryKey: canvasKey(projectId) });
        return;
      }
      dirty.current = true;
      setSaveState("error");
      setError(talentErrorMessage(e));
    }
  }, [projectId, qc, save]);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  }, [flush]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<CanvasNodeData>) => {
      setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, data: { ...n.data.data, ...patch } } } : n)));
      markDirty();
    },
    [setNodes, markDirty],
  );

  const runNodes = useCallback(
    async (nodeIds: string[]) => {
      setError(null);
      setNotice(null);
      if (!nodeIds.length) {
        setError("Нет узлов для запуска: подключите сцены к «Монтажу» и «Выдаче».");
        return;
      }
      if (dirty.current) await flush();
      setPending(new Set(nodeIds));
      try {
        setQuote(await quoteMut.mutateAsync(nodeIds));
      } catch (e) {
        setPending(new Set());
        const nodeId = e instanceof ApiError ? (e.body as { nodeId?: string } | undefined)?.nodeId : undefined;
        const name = nodeId ? latest.current.nodes.find((n) => n.id === nodeId) : undefined;
        setError(`${talentErrorMessage(e)}${name ? ` (узел «${CANVAS_NODE_LABEL[name.data.kind]}»)` : ""}`);
      }
    },
    [flush, quoteMut],
  );

  async function approve() {
    if (!quote) return;
    try {
      await confirm.mutateAsync(quote);
      setNotice("Запущено — статусы узлов обновятся сами.");
    } catch (e) {
      setError(talentErrorMessage(e));
    } finally {
      setQuote(null);
      setPending(new Set());
    }
  }

  async function cancel() {
    if (!quote) return;
    const q = quote;
    setQuote(null);
    setPending(new Set());
    try {
      await reject.mutateAsync(q);
    } catch {
      /* card stays in chat; nothing was started */
    }
  }

  function addNode(kind: CanvasNodeKind) {
    const vp = viewportRef.current;
    const id = newNodeId(kind);
    const position = { x: Math.round((-vp.x + 200) / vp.zoom), y: Math.round((-vp.y + 120) / vp.zoom) };
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      { id, type: "canvasNode" as const, position, selected: true, data: { kind, data: kind === "scene_video" || kind === "avatar_video" ? { durationSeconds: 5 } : {} } },
    ]);
    markDirty();
  }

  const isValidConnection: IsValidConnection = useCallback(
    (c) => {
      const s = latest.current.nodes.find((n) => n.id === c.source);
      const t = latest.current.nodes.find((n) => n.id === c.target);
      if (!s || !t || s.id === t.id) return false;
      return canConnectCanvasNodes({ kind: s.data.kind, data: s.data.data }, { kind: t.data.kind, data: t.data.data });
    },
    [],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((es) => addEdge({ ...c, id: `e:${c.source}->${c.target}` }, es));
      markDirty();
    },
    [setEdges, markDirty],
  );

  const ctx: CanvasCtx = useMemo(
    () => ({ projectId, view, pendingNodeIds: pending, runNodes: (ids) => void runNodes(ids), updateNodeData }),
    [projectId, view, pending, runNodes, updateNodeData],
  );

  // Persist the selection from rendered state (restored after F5).
  const selectedKey = nodes
    .filter((n) => n.selected)
    .map((n) => n.id)
    .join("|");
  useEffect(() => {
    writeSelection(projectId, selectedKey ? selectedKey.split("|") : []);
  }, [projectId, selectedKey]);

  const runAllIds = useMemo(() => runnableAncestors(fromFlow(nodes, edges)), [nodes, edges]);

  return (
    <CanvasContext.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col" data-testid="canvas-root" data-version={view.version}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Clapperboard className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Холст сцен</span>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            value=""
            data-testid="canvas-add-node"
            onChange={(e) => e.target.value && addNode(e.target.value as CanvasNodeKind)}
          >
            <option value="">+ Добавить узел</option>
            {ADDABLE.map((k) => (
              <option key={k} value={k}>
                {CANVAS_NODE_LABEL[k]}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => void runNodes(runAllIds)} disabled={pending.size > 0} data-testid="canvas-run-all">
            Собрать всё — узнать цену ({runAllIds.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void qc.invalidateQueries({ queryKey: canvasKey(projectId) })}
            data-testid="canvas-refresh"
            title="Подтянуть новые сцены из раскадровки"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Из раскадровки
          </Button>
          {view.mock ? <Badge variant="demo">Тестовый режим: $0</Badge> : null}
          <span className="ml-auto text-[11px] text-muted-foreground" data-testid="canvas-save-state" data-state={saveState}>
            {saveState === "saved" ? "Сохранено" : saveState === "saving" ? "Сохраняю…" : saveState === "dirty" ? "Есть изменения" : "Не сохранено"}
          </span>
        </div>
        {view.orphanSceneIds.length ? (
          <p className="border-b border-border bg-[var(--sb-warning)]/10 px-3 py-1 text-xs text-[var(--sb-warning)]" data-testid="canvas-orphans">
            {view.orphanSceneIds.length === 1 ? "Одна сцена удалена" : `Сцен удалено: ${view.orphanSceneIds.length}`} из раскадровки — её узлы
            остались на холсте, удалите их вручную, если они не нужны.
          </p>
        ) : null}
        {!view.scenes.length ? (
          <p className="border-b border-border px-3 py-1 text-xs text-muted-foreground" data-testid="canvas-empty">
            В раскадровке пока нет сцен. Попросите агента написать сценарий — сцены появятся здесь автоматически.
          </p>
        ) : null}
        <div className="relative min-h-[420px] flex-1">
          <ReactFlow<FlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              if (changes.some((c) => c.type === "remove" || (c.type === "position" && c.dragging === false))) markDirty();
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              if (changes.some((c) => c.type === "remove")) markDirty();
            }}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            defaultViewport={view.payload.viewport}
            onMoveEnd={(_e, vp) => {
              const prev = viewportRef.current;
              viewportRef.current = vp;
              if (Math.abs(prev.x - vp.x) > 1 || Math.abs(prev.y - vp.y) > 1 || Math.abs(prev.zoom - vp.zoom) > 0.001) markDirty();
            }}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode={["Delete", "Backspace"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden md:!block" />
          </ReactFlow>
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-end gap-2">
            {quote ? (
              <div className="pointer-events-auto w-full max-w-sm">
                <QuoteCard quote={quote} onApprove={() => void approve()} onCancel={() => void cancel()} busy={confirm.isPending} />
              </div>
            ) : null}
            {error ? (
              <p className="pointer-events-auto max-w-sm rounded border border-destructive/40 bg-card px-3 py-2 text-xs text-destructive" data-testid="canvas-error">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="pointer-events-auto max-w-sm rounded border border-border bg-card px-3 py-2 text-xs" data-testid="canvas-notice">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </CanvasContext.Provider>
  );
}

export function SceneCanvas({ projectId }: { projectId: string }) {
  const q = useCanvas(projectId);
  if (q.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground" data-testid="canvas-loading">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Загружаю холст…
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm" data-testid="canvas-load-error">
        <p className="text-destructive">Не удалось загрузить холст: {talentErrorMessage(q.error)}</p>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <CanvasEditor projectId={projectId} view={q.data} />
    </ReactFlowProvider>
  );
}
