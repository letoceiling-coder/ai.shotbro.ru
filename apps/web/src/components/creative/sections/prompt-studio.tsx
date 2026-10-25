"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { useActiveScript } from "@/hooks/use-creative-documents";
import { useStudioStore } from "@/store/studio-store";
import type { ScenePromptBundle } from "@shotbro/contracts";
import { WorkspaceState } from "./workspace-state";

type PromptRow = {
  version: number;
  modelId: string | null;
  bundle: ScenePromptBundle | null;
  createdAt?: string;
  createdBy?: string;
};

const emptyBundle = (): ScenePromptBundle => ({
  image: { prompt: "" },
  video: {},
  imageModelId: "mock/image",
  videoModelId: "mock/video",
});

export function PromptStudio({ projectId }: { projectId: string }) {
  const pinnedSceneId = useStudioStore((s) => s.creativePromptSceneId);
  const setPinnedSceneId = useStudioStore((s) => s.setCreativePromptSceneId);
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const { data: script } = useActiveScript(projectId);
  const scenes = script?.payload.scenes ?? [];
  const [sceneId, setSceneId] = useState<string | null>(null);
  const selectedSceneId = sceneId ?? pinnedSceneId ?? scenes[0]?.id ?? null;

  useEffect(() => {
    if (pinnedSceneId && pinnedSceneId !== sceneId) setSceneId(pinnedSceneId);
  }, [pinnedSceneId, sceneId]);

  const qc = useQueryClient();

  const { data: list, isLoading } = useQuery({
    queryKey: ["scene-prompts", projectId, selectedSceneId],
    enabled: Boolean(selectedSceneId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/prompts`) as Promise<{
        items: PromptRow[];
      }>,
  });

  const latest = list?.items?.[0];
  const [draft, setDraft] = useState<ScenePromptBundle>(emptyBundle());
  const [viewVersion, setViewVersion] = useState<number | "latest">("latest");
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [promptTab, setPromptTab] = useState<"image" | "video">("image");

  useEffect(() => {
    if (viewVersion === "latest" && latest?.bundle) {
      setDraft(latest.bundle);
    }
  }, [latest?.version, latest?.bundle, viewVersion]);

  const loadVersion = useMutation({
    mutationFn: (version: number) =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/prompts/versions/${version}`) as Promise<
        PromptRow & { bundle: ScenePromptBundle | null }
      >,
    onSuccess: (row) => {
      if (row.bundle) setDraft(row.bundle);
      setViewVersion(row.version);
    },
  });

  const save = useMutation({
    mutationFn: (changeNote?: string) =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/prompts`, {
        method: "POST",
        body: JSON.stringify({ bundle: draft, changeNote }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scene-prompts", projectId, selectedSceneId] });
      setViewVersion("latest");
    },
  });

  const restore = useMutation({
    mutationFn: (version: number) =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/prompts/restore`, {
        method: "POST",
        body: JSON.stringify({ version }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scene-prompts", projectId, selectedSceneId] });
      setViewVersion("latest");
    },
  });

  const validate = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/prompts/validate`, {
        method: "POST",
        body: JSON.stringify({
          modelId: draft.imageModelId,
          operation: "TEXT_TO_IMAGE",
          parameters: draft.modelParameters?.[draft.imageModelId] ?? {},
        }),
      }) as Promise<{ valid: boolean; issues?: Array<{ key: string; message: string }> }>,
    onSuccess: (res) => {
      setValidationMsg(
        res.valid ? "Model parameters OK (mock routing)" : res.issues?.map((i) => `${i.key}: ${i.message}`).join(", ") ?? "Invalid",
      );
    },
  });

  const versions = useMemo(() => list?.items ?? [], [list?.items]);
  const comparePair = versions.length >= 2 ? [versions[1]!.version, versions[0]!.version] : null;

  const { data: compare } = useQuery({
    queryKey: ["prompt-compare", projectId, selectedSceneId, comparePair?.[0], comparePair?.[1]],
    enabled: Boolean(selectedSceneId && comparePair),
    queryFn: () =>
      apiFetch(
        `/api/v1/projects/${projectId}/scenes/${selectedSceneId}/prompts/compare?a=${comparePair![0]}&b=${comparePair![1]}`,
      ) as Promise<{ diffs: Array<{ path: string }> }>,
  });

  if (!selectedSceneId || scenes.length === 0) {
    return (
      <WorkspaceState
        title="Prompt Studio"
        state="empty"
        message="Добавьте сцену в Script, затем задайте image/video промпты."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="prompt-studio">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Prompt Studio</h2>
        <Select
          value={selectedSceneId}
          onValueChange={(id) => {
            setSceneId(id);
            setPinnedSceneId(id);
            setViewVersion("latest");
          }}
        >
          <SelectTrigger className="w-[220px]" data-testid="prompt-scene-select">
            <SelectValue placeholder="Scene" />
          </SelectTrigger>
          <SelectContent>
            {scenes.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title || s.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline">v{viewVersion === "latest" ? (latest?.version ?? "—") : viewVersion}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setSection("storyboard")}>
            Storyboard
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSection("references")}>
            References
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSection("models")}>
            Model settings
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3">
          <Label>Versions</Label>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
            {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
            {versions.map((v) => (
              <button
                key={v.version}
                type="button"
                data-testid={`prompt-version-${v.version}`}
                className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-muted"
                onClick={() => loadVersion.mutate(v.version)}
              >
                <span>v{v.version}</span>
                <span className="text-muted-foreground">{v.modelId?.split("/").pop()}</span>
              </button>
            ))}
            {versions.length === 0 ? <p className="text-muted-foreground">No versions yet</p> : null}
          </div>
          {comparePair ? (
            <p className="text-xs text-muted-foreground">
              Diff v{comparePair[0]}→v{comparePair[1]}: {compare?.diffs?.length ?? 0} field(s)
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid="prompt-restore"
            disabled={viewVersion === "latest" || typeof viewVersion !== "number"}
            onClick={() => typeof viewVersion === "number" && restore.mutate(viewVersion)}
          >
            Restore selected → new version
          </Button>
        </aside>

        <div className="space-y-4">
          <div className="flex gap-2 border-b border-border pb-2">
            <Button
              type="button"
              size="sm"
              variant={promptTab === "image" ? "default" : "ghost"}
              onClick={() => setPromptTab("image")}
            >
              Image prompt
            </Button>
            <Button
              type="button"
              size="sm"
              variant={promptTab === "video" ? "default" : "ghost"}
              data-testid="prompt-tab-video"
              onClick={() => setPromptTab("video")}
            >
              Video prompt
            </Button>
          </div>
          {promptTab === "image" ? (
            <div className="space-y-3 pt-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Prompt</Label>
                  <Textarea
                    rows={3}
                    data-testid="prompt-image-text"
                    value={draft.image.prompt}
                    onChange={(e) => setDraft({ ...draft, image: { ...draft.image, prompt: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Negative prompt</Label>
                  <Input
                    value={draft.image.negativePrompt ?? ""}
                    onChange={(e) => setDraft({ ...draft, image: { ...draft.image, negativePrompt: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Image model</Label>
                  <Select
                    value={draft.imageModelId}
                    onValueChange={(v) => setDraft({ ...draft, imageModelId: v })}
                  >
                    <SelectTrigger data-testid="prompt-model-image-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock/image">mock/image</SelectItem>
                      <SelectItem value="fal-ai/flux/dev">fal-ai/flux/dev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Visual style</Label>
                  <Input
                    value={draft.image.visualStyle ?? ""}
                    onChange={(e) => setDraft({ ...draft, image: { ...draft.image, visualStyle: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Composition</Label>
                  <Input
                    value={draft.image.composition ?? ""}
                    onChange={(e) => setDraft({ ...draft, image: { ...draft.image, composition: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Lighting</Label>
                  <Input
                    value={draft.image.lighting ?? ""}
                    onChange={(e) => setDraft({ ...draft, image: { ...draft.image, lighting: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Camera angle</Label>
                  <Input
                    value={draft.image.cameraAngle ?? ""}
                    onChange={(e) => setDraft({ ...draft, image: { ...draft.image, cameraAngle: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Character / product refs (notes)</Label>
                  <Textarea
                    rows={2}
                    value={[draft.image.characterRefNotes, draft.image.productRefNotes].filter(Boolean).join("\n")}
                    onChange={(e) => {
                      const [a, b] = e.target.value.split("\n");
                      setDraft({
                        ...draft,
                        image: {
                          ...draft.image,
                          characterRefNotes: a,
                          productRefNotes: b,
                        },
                      });
                    }}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>First frame requirements</Label>
                  <Input
                    value={draft.image.firstFrameRequirements ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, image: { ...draft.image, firstFrameRequirements: e.target.value } })
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Scene action</Label>
                  <Textarea
                    rows={2}
                    data-testid="prompt-video-action"
                    value={draft.video.sceneAction ?? ""}
                    onChange={(e) => setDraft({ ...draft, video: { ...draft.video, sceneAction: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Camera movement</Label>
                  <Input
                    value={draft.video.cameraMovement ?? ""}
                    onChange={(e) => setDraft({ ...draft, video: { ...draft.video, cameraMovement: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Character movement</Label>
                  <Input
                    value={draft.video.characterMovement ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, video: { ...draft.video, characterMovement: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Dialogue</Label>
                  <Textarea
                    rows={2}
                    value={draft.video.dialogue ?? ""}
                    onChange={(e) => setDraft({ ...draft, video: { ...draft.video, dialogue: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Video model</Label>
                  <Select
                    value={draft.videoModelId}
                    onValueChange={(v) => setDraft({ ...draft, videoModelId: v })}
                  >
                    <SelectTrigger data-testid="prompt-model-video-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mock/video">mock/video</SelectItem>
                      <SelectItem value="fal-ai/kling-video/v1/standard/image-to-video">fal kling i2v</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (s)</Label>
                  <Input
                    type="number"
                    value={draft.video.durationSeconds ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        video: { ...draft.video, durationSeconds: Number(e.target.value) || undefined },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Aspect ratio</Label>
                  <Input
                    value={draft.video.aspectRatio ?? "9:16"}
                    onChange={(e) => setDraft({ ...draft, video: { ...draft.video, aspectRatio: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Motion instructions</Label>
                  <Textarea
                    rows={2}
                    value={draft.video.motionInstructions ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, video: { ...draft.video, motionInstructions: e.target.value } })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              data-testid="prompt-save"
              disabled={!draft.image.prompt.trim() || save.isPending}
              onClick={() => save.mutate(undefined)}
            >
              Save new version
            </Button>
            <Button type="button" variant="outline" data-testid="prompt-validate" onClick={() => validate.mutate()}>
              Validate model params
            </Button>
            {validationMsg ? <span className="text-xs text-muted-foreground">{validationMsg}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
