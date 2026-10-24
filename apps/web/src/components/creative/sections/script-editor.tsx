"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useActiveScript,
  usePatchScriptScene,
  useScriptSceneMutations,
} from "@/hooks/use-creative-documents";
import type { ScriptDocument } from "@shotbro/contracts";

type Scene = ScriptDocument["scenes"][number];

export function ScriptEditor({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error } = useActiveScript(projectId);
  const patchScene = usePatchScriptScene(projectId);
  const { addScene, deleteScene, duplicateScene, reorderScenes } = useScriptSceneMutations(projectId);
  const scenes = data?.payload.scenes ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Scene> | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");

  const selected = useMemo(
    () => scenes.find((s) => s.id === selectedId) ?? scenes[0],
    [scenes, selectedId],
  );

  useEffect(() => {
    if (selected && selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (selected) setDraft({ ...selected });
    setSaveState("idle");
  }, [selected?.id, selected?.revision, data?.version]);

  if (isLoading) {
    return <WorkspaceState title="Сценарий" state="loading" />;
  }
  if (isError || !data) {
    const missing = String(error).includes("404");
    return (
      <WorkspaceState
        title="Сценарий"
        state="empty"
        message={
          missing
            ? "Сценарий появится после шага SCRIPT в чате с агентом. Запросите ролик в AI Chat."
            : "Не удалось загрузить сценарий с сервера."
        }
      />
    );
  }

  const total = data.payload.totalDurationSeconds;

  async function persistDraft() {
    if (!selected || !draft) return;
    setSaveState("saving");
    try {
      await patchScene.mutateAsync({
        sceneId: selected.id,
        patch: {
          expectedRevision: selected.revision,
          title: draft.title,
          durationSeconds: draft.durationSeconds,
          description: draft.description,
          action: draft.action,
          dialogue: draft.dialogue,
          voiceover: draft.voiceover,
          camera: draft.camera,
          lighting: draft.lighting,
          location: draft.location,
          visualStyle: draft.visualStyle,
          transition: draft.transition,
        },
      });
      setSaveState("saved");
    } catch (e) {
      setSaveState(String(e).includes("409") || String(e).includes("conflict") ? "conflict" : "error");
    }
  }

  function moveScene(index: number, dir: -1 | 1) {
    const next = [...scenes];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    reorderScenes.mutate(next.map((s) => s.id));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="script-editor">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">{data.payload.title}</h2>
          <p className="text-xs text-muted-foreground">
            v{data.version} · {scenes.length} сцен · {total}s
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => addScene.mutate({})} disabled={addScene.isPending}>
          <Plus className="mr-1 size-3.5" />
          Сцена
        </Button>
      </header>
      <div className="grid min-h-0 flex-1 md:grid-cols-[240px_1fr]">
        <ScrollArea className="border-b border-border md:border-b-0 md:border-r">
          <ul className="space-y-1 p-2">
            {scenes.map((scene, index) => (
              <li key={scene.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(scene.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selected?.id === scene.id ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-muted/60",
                  )}
                >
                  <span className="mt-0.5 text-muted-foreground">
                    <GripVertical className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{scene.sequence}. {scene.title}</span>
                    <span className="block text-xs text-muted-foreground">{scene.durationSeconds}s</span>
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(index, -1);
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(index, 1);
                      }}
                    >
                      ↓
                    </Button>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
        {selected && draft ? (
          <ScrollArea className="min-h-0 flex-1 p-4">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">rev {selected.revision}</Badge>
                {saveState === "saved" ? <Badge variant="secondary">Сохранено</Badge> : null}
                {saveState === "conflict" ? (
                  <Badge variant="outline" className="border-destructive text-destructive">
                    Конфликт версии — обновите страницу
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="scene-title">Название</Label>
                  <Input
                    id="scene-title"
                    value={draft.title ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scene-duration">Длительность (с)</Label>
                  <Input
                    id="scene-duration"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={draft.durationSeconds ?? 3}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, durationSeconds: Number.parseFloat(e.target.value) || 3 }))
                    }
                  />
                </div>
              </div>
              <Field label="Описание" id="scene-desc" value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} />
              <Field label="Действие" id="scene-action" value={draft.action} onChange={(v) => setDraft((d) => ({ ...d, action: v }))} />
              <Field label="Диалог" id="scene-dialogue" value={draft.dialogue} onChange={(v) => setDraft((d) => ({ ...d, dialogue: v }))} />
              <Field label="Voiceover" id="scene-vo" value={draft.voiceover} onChange={(v) => setDraft((d) => ({ ...d, voiceover: v }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Камера" id="scene-cam" value={draft.camera} onChange={(v) => setDraft((d) => ({ ...d, camera: v }))} />
                <Field label="Свет" id="scene-light" value={draft.lighting} onChange={(v) => setDraft((d) => ({ ...d, lighting: v }))} />
              </div>
              <Field label="Локация" id="scene-loc" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => void persistDraft()} disabled={patchScene.isPending || saveState === "saving"}>
                  Сохранить сцену
                </Button>
                <Button
                  variant="outline"
                  onClick={() => duplicateScene.mutate(selected.id)}
                  disabled={duplicateScene.isPending}
                >
                  <Copy className="mr-1 size-3.5" />
                  Дублировать
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteScene.mutate(selected.id)}
                  disabled={deleteScene.isPending || scenes.length <= 1}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Удалить
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function WorkspaceState({
  title,
  state,
  message,
}: {
  title: string;
  state: "loading" | "empty";
  message?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center" data-testid="workspace-state">
      <h2 className="text-lg font-semibold">{title}</h2>
      {state === "loading" ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
