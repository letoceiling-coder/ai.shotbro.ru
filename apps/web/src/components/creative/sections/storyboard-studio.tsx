"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, PanelRightOpen, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useModelCatalog } from "@/hooks/use-studio-production";
import {
  useActiveStoryboard,
  useCharacters,
  usePatchStoryboardScene,
  useReferences,
  useReorderStoryboard,
  useSyncStoryboard,
} from "@/hooks/use-creative-studio";
import { useScriptSceneMutations } from "@/hooks/use-creative-documents";
import { AssetPickerDialog } from "./asset-picker-dialog";
import { WorkspaceState } from "./workspace-state";
import type { StoryboardScene } from "@shotbro/contracts";
import type { ReactNode } from "react";

type ViewMode = "grid" | "list" | "detail";

export function StoryboardStudio({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useActiveStoryboard(projectId);
  const sync = useSyncStoryboard(projectId);
  const patchScene = usePatchStoryboardScene(projectId);
  const reorder = useReorderStoryboard(projectId);
  const { addScene } = useScriptSceneMutations(projectId);
  const { data: characters } = useCharacters(projectId);
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"first" | "last" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [videoModelId, setVideoModelId] = useState("mock/video");
  const [descDraft, setDescDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");

  const scenes = data?.payload.scenes ?? [];
  const selected = useMemo(
    () => scenes.find((s) => s.sceneId === selectedId) ?? scenes[0],
    [scenes, selectedId],
  );
  const { data: sceneRefs } = useReferences(projectId, selected ? { sceneId: selected.sceneId } : undefined);

  useEffect(() => {
    if (selected && selectedId !== selected.sceneId) setSelectedId(selected.sceneId);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!data && !sync.isPending && !isLoading) {
      void sync.mutateAsync().catch(() => null);
    }
  }, [data, isLoading, sync]);

  useEffect(() => {
    if (selected) {
      setDescDraft(selected.description ?? "");
      setTitleDraft(selected.title ?? "");
    }
  }, [selected?.sceneId, selected?.revision, selected?.description, selected?.title]);

  const { data: catalog } = useModelCatalog();
  const { data: paramDef } = useQuery({
    queryKey: ["model-parameters", videoModelId, "IMAGE_TO_VIDEO"],
    queryFn: () =>
      apiFetch(
        `/api/v1/providers/model-parameters/${encodeURIComponent(videoModelId)}?operation=IMAGE_TO_VIDEO`,
      ) as Promise<{ found: boolean; definition?: { parameterSchema: Array<{ key: string }> } }>,
  });
  const supportsLastFrame =
    videoModelId === "mock/video" ||
    Boolean(
      paramDef?.definition?.parameterSchema?.some(
        (p) => p.key === "last_frame" || p.key === "end_image_url" || p.key === "tail_image_url",
      ),
    );
  const supportsFirstFrame =
    catalog?.models.some((m) => m.modelId === videoModelId && m.supportedOperations.includes("IMAGE_TO_VIDEO")) ||
    videoModelId === "mock/video";

  if (isLoading || sync.isPending) {
    return <WorkspaceState title="Storyboard" state="loading" />;
  }
  if (isError && !data) {
    const missing = String(error).includes("404");
    return (
      <WorkspaceState
        title="Storyboard"
        state="empty"
        message={
          missing
            ? "Сначала добавьте сцены в Script, затем нажмите «Синхронизировать»."
            : "Не удалось загрузить storyboard."
        }
      />
    );
  }

  async function persistScene(patch: Partial<StoryboardScene>) {
    if (!selected) return;
    setSaveState("saving");
    try {
      await patchScene.mutateAsync({
        sceneId: selected.sceneId,
        patch: { ...patch, expectedRevision: selected.revision },
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function setFrame(kind: "first" | "last", assetId: string) {
    if (!selected) return;
    const key = kind === "first" ? "firstFrameAssetId" : "lastFrameAssetId";
    await persistScene({ [key]: assetId });
    if (kind === "first") {
      await apiFetch(`/api/v1/projects/${projectId}/references`, {
        method: "POST",
        body: JSON.stringify({ assetId, role: "FIRST_FRAME", sceneId: selected.sceneId }),
      }).catch(() => null);
    }
    if (kind === "last") {
      await apiFetch(`/api/v1/projects/${projectId}/references`, {
        method: "POST",
        body: JSON.stringify({ assetId, role: "LAST_FRAME", sceneId: selected.sceneId }),
      }).catch(() => null);
    }
    void refetch();
  }

  function moveScene(index: number, dir: -1 | 1) {
    const next = [...scenes];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    reorder.mutate(next.map((s) => s.sceneId));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="storyboard-studio">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Storyboard Studio</h2>
        <Badge variant="outline">v{data?.version ?? 1}</Badge>
        <Badge variant="secondary">{scenes.length} сцен</Badge>
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="storyboard-sync"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Sync script
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => addScene.mutate({ title: "Новая сцена" })}>
            + Сцена (script)
          </Button>
          <ViewToggle view={view} setView={setView} />
        </div>
      </header>

      {scenes.length === 0 ? (
        <WorkspaceState title="Storyboard" state="empty" message="Добавьте сцену в Script и синхронизируйте." />
      ) : view === "detail" && selected ? (
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4" data-testid="storyboard-scene-detail">
            <div className="flex items-center gap-2">
              <Badge>#{selected.order}</Badge>
              <Input
                className="max-w-md"
                value={selected.title}
                onChange={(e) => void persistScene({ title: e.target.value })}
                data-testid="storyboard-scene-title"
              />
              <Badge variant="outline">rev {selected.revision}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FrameCard
                label="First frame"
                assetId={selected.firstFrameAssetId}
                onAssign={() => setPicker("first")}
                testId="storyboard-first-frame"
              />
              <FrameCard
                label="Last frame"
                assetId={selected.lastFrameAssetId}
                onAssign={() => setPicker("last")}
                testId="storyboard-last-frame"
                warning={
                  selected.lastFrameAssetId && !supportsLastFrame
                    ? "Выбранная video-модель не поддерживает last frame — смените модель или уберите кадр."
                    : undefined
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Video model</Label>
              <Select value={videoModelId} onValueChange={setVideoModelId}>
                <SelectTrigger data-testid="storyboard-video-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock/video">mock/video</SelectItem>
                  <SelectItem value="fal-ai/kling-video/v1/standard/image-to-video">fal kling i2v</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Mock routing only — live execution disabled. First frame: {supportsFirstFrame ? "да" : "нет"} · Last
                frame: {supportsLastFrame ? "да" : "нет"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Описание</Label>
              <Textarea
                rows={4}
                data-testid="storyboard-scene-description"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={() => void persistScene({ description: descDraft })}
              />
            </div>
            <div>
              <Label>Персонажи</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.characterIds.map((id) => {
                  const c = characters?.items.find((x) => x.id === id);
                  return (
                    <Badge key={id} variant="secondary">
                      {c?.name ?? id.slice(0, 6)} v{selected.characterVersionById[id] ?? c?.version ?? "?"}
                    </Badge>
                  );
                })}
                {selected.characterIds.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Назначьте в Character Studio</span>
                ) : null}
              </div>
            </div>
            <div>
              <Label>Референсы сцены</Label>
              <p className="text-xs text-muted-foreground">{sceneRefs?.items.length ?? 0} связей</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Сохранение: {saveState === "saving" ? "…" : saveState === "saved" ? "OK" : saveState === "error" ? "ошибка" : "—"}
            </p>
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
          <div
            className={cn(
              "gap-3 p-3",
              view === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col",
            )}
            data-testid="storyboard-scene-grid"
          >
            {scenes.map((scene, index) => (
              <button
                key={scene.sceneId}
                type="button"
                data-testid={`storyboard-scene-${scene.sceneId}`}
                className={cn(
                  "rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40",
                  selected?.sceneId === scene.sceneId && "ring-2 ring-primary/30",
                  view === "list" && "flex flex-row items-center gap-3",
                )}
                onClick={() => {
                  setSelectedId(scene.sceneId);
                  setView("detail");
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">#{scene.order}</span>
                  <Badge variant="outline">{scene.durationSeconds}s</Badge>
                </div>
                <p className="mt-1 font-medium">{scene.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {scene.firstFrameAssetId ? <Badge variant="secondary">1st</Badge> : null}
                  {scene.lastFrameAssetId ? <Badge variant="secondary">last</Badge> : null}
                  <Badge variant="outline">{scene.status}</Badge>
                </div>
                <div className="mt-2 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveScene(index, -1);
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveScene(index, 1);
                    }}
                  >
                    ↓
                  </Button>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      <AssetPickerDialog
        projectId={projectId}
        open={picker !== null}
        onOpenChange={(o) => !o && setPicker(null)}
        title={picker === "last" ? "Last frame" : "First frame"}
        onPick={(id) => void (picker ? setFrame(picker, id) : undefined)}
      />
    </div>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  const btn = (mode: ViewMode, icon: ReactNode, testId: string) => (
    <Button
      type="button"
      size="icon"
      variant={view === mode ? "default" : "ghost"}
      className="h-8 w-8"
      data-testid={testId}
      onClick={() => setView(mode)}
    >
      {icon}
    </Button>
  );
  return (
    <div className="flex rounded-md border border-border p-0.5">
      {btn("grid", <LayoutGrid className="h-4 w-4" />, "storyboard-view-grid")}
      {btn("list", <List className="h-4 w-4" />, "storyboard-view-list")}
      {btn("detail", <PanelRightOpen className="h-4 w-4" />, "storyboard-view-detail")}
    </div>
  );
}

function FrameCard({
  label,
  assetId,
  onAssign,
  testId,
  warning,
}: {
  label: string;
  assetId?: string;
  onAssign: () => void;
  testId: string;
  warning?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3" data-testid={testId}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" size="sm" variant="secondary" onClick={onAssign}>
          Назначить
        </Button>
      </div>
      {assetId ? <p className="truncate text-xs text-muted-foreground">{assetId}</p> : <p className="text-xs text-muted-foreground">Не задан</p>}
      {warning ? <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{warning}</p> : null}
    </div>
  );
}
