"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api-client";
import { useStudioStore } from "@/store/studio-store";
import type { TimelineClip, TimelineDocument } from "@shotbro/contracts";
import { WorkspaceState } from "./workspace-state";

type TimelineRow = {
  id: string;
  version: number;
  payload: TimelineDocument;
  timelineHash?: string;
};

export function TimelineStudio({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<TimelineDocument | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/timeline`) as Promise<TimelineRow>,
  });

  const doc = draft ?? data?.payload ?? null;
  const videoClips = useMemo(() => {
    const track = doc?.tracks.find((t) => t.type === "VIDEO");
    return [...(track?.clips ?? [])].sort((a, b) => a.order - b.order);
  }, [doc]);
  const selected = videoClips.find((c) => c.clipId === selectedClipId) ?? videoClips[0] ?? null;

  const sync = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }),
    onSuccess: (row) => {
      qc.setQueryData(["timeline", projectId], row);
      setDraft(null);
      setDirty(false);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (!doc) throw new Error("no timeline");
      return apiFetch(`/api/v1/projects/${projectId}/timeline`, {
        method: "PATCH",
        body: JSON.stringify({ payload: doc, expectedRevision: doc.revision }),
      });
    },
    onSuccess: (row) => {
      qc.setQueryData(["timeline", projectId], row);
      setDraft(null);
      setDirty(false);
    },
  });

  const validate = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/timeline/validate`, { method: "POST", body: "{}" }) as Promise<{
        valid: boolean;
        issues?: Array<{ code: string; clipId?: string }>;
      }>,
  });

  const { data: assets } = useQuery({
    queryKey: ["assets", projectId],
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/assets`) as Promise<
        Array<{ id: string; mimeType: string; originalName?: string }>
      >,
  });

  const videoAssets = (assets ?? []).filter((a) => a.mimeType.startsWith("video/"));

  const updateClip = (patch: Partial<TimelineClip>) => {
    if (!doc || !selected) return;
    const tracks = doc.tracks.map((t) => {
      if (t.type !== "VIDEO") return t;
      return {
        ...t,
        clips: t.clips.map((c) => (c.clipId === selected.clipId ? { ...c, ...patch } : c)),
      };
    });
    setDraft({ ...doc, tracks });
    setDirty(true);
  };

  const moveClip = (clipId: string, dir: -1 | 1) => {
    if (!doc) return;
    const order = videoClips.map((c) => c.clipId);
    const idx = order.indexOf(clipId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j]!, order[idx]!];
    void apiFetch(`/api/v1/projects/${projectId}/timeline/reorder`, {
      method: "POST",
      body: JSON.stringify({ trackId: "track-video", clipIds: order, expectedRevision: doc.revision }),
    }).then((row) => {
      qc.setQueryData(["timeline", projectId], row);
      setDraft(null);
      setDirty(false);
    });
  };

  if (isLoading) {
    return <WorkspaceState title="Timeline" state="loading" message="Загрузка монтажа…" />;
  }

  if (!doc) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8" data-testid="timeline-studio">
        <WorkspaceState title="Timeline" state="empty" message="Синхронизируйте Storyboard, чтобы создать дорожки." />
        <Button type="button" data-testid="timeline-sync-storyboard" onClick={() => sync.mutate()}>
          Sync from Storyboard
        </Button>
      </div>
    );
  }

  const totalSec = (doc.totalDurationMs / 1000).toFixed(1);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="timeline-studio">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <Badge variant="outline">rev {doc.revision}</Badge>
        <Badge variant="secondary">{totalSec}s</Badge>
        {dirty ? <Badge variant="destructive">unsaved</Badge> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" data-testid="timeline-sync-storyboard" onClick={() => sync.mutate()}>
            Sync Storyboard
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSection("storyboard")}>
            Storyboard
          </Button>
          <Button type="button" size="sm" variant="outline" data-testid="timeline-validate" onClick={() => validate.mutate()}>
            Validate
          </Button>
          <Button type="button" size="sm" data-testid="timeline-save" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            Save version
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3" data-testid="timeline-preview">
            <p className="text-xs text-muted-foreground">Preview (mock) — порядок clips = порядок FFmpeg concat</p>
            <p className="mt-2 font-mono text-sm">{videoClips.map((c) => c.sceneId?.slice(0, 6) ?? c.clipId).join(" → ")}</p>
          </div>
          <ScrollArea className="h-48 rounded-lg border border-border">
            <div className="space-y-1 p-2" data-testid="timeline-video-track">
              <p className="text-xs font-medium text-muted-foreground">Video track</p>
              {videoClips.map((clip) => (
                <button
                  key={clip.clipId}
                  type="button"
                  data-testid={`timeline-clip-${clip.clipId}`}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                    selected?.clipId === clip.clipId ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedClipId(clip.clipId)}
                >
                  <span>
                    #{clip.order + 1} {clip.sceneId?.slice(0, 8) ?? clip.clipId} · {(clip.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span className="flex gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      data-testid={`timeline-clip-up-${clip.clipId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveClip(clip.clipId, -1);
                      }}
                    >
                      ↑
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      data-testid={`timeline-clip-down-${clip.clipId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveClip(clip.clipId, 1);
                      }}
                    >
                      ↓
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
          {validate.data ? (
            <p className="text-xs text-muted-foreground">
              Validation: {validate.data.valid ? "OK" : validate.data.issues?.map((i) => i.code).join(", ")}
            </p>
          ) : null}
        </div>

        <aside className="space-y-3 rounded-lg border border-border p-3" data-testid="timeline-clip-props">
          <Label>Clip properties</Label>
          {selected ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Duration (ms)</Label>
                <Input
                  type="number"
                  data-testid="timeline-clip-duration"
                  value={selected.durationMs}
                  onChange={(e) => updateClip({ durationMs: Number(e.target.value) || 1000 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Video asset</Label>
                <Select
                  value={selected.assetId ?? "__none__"}
                  onValueChange={(v) =>
                    updateClip({
                      assetId: v === "__none__" ? undefined : v,
                      status: v === "__none__" ? "missing" : "ready",
                    })
                  }
                >
                  <SelectTrigger data-testid="timeline-clip-asset">
                    <SelectValue placeholder="Assign asset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— scene mock —</SelectItem>
                    {videoAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.originalName ?? a.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Select a clip</p>
          )}
        </aside>
      </div>
    </div>
  );
}
