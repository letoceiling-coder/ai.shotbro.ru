"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAssetDetail,
  useAssetPreviewUrl,
  useDeleteAsset,
  useRenameAsset,
} from "@/hooks/use-asset-library";
import {
  useActiveStoryboard,
  useAttachReference,
  usePatchStoryboardScene,
} from "@/hooks/use-creative-studio";
import { apiFetch } from "@/lib/api-client";
import { useStudioStore } from "@/store/studio-store";
import { AssetPreviewThumb } from "./asset-preview-thumb";
import { useState } from "react";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms?: number | null) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AssetDetailSheet({
  projectId,
  assetId,
  open,
  onOpenChange,
}: {
  projectId: string;
  assetId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading } = useAssetDetail(assetId ?? undefined);
  const rename = useRenameAsset(projectId);
  const del = useDeleteAsset(projectId);
  const attachRef = useAttachReference(projectId);
  const patchScene = usePatchStoryboardScene(projectId);
  const { data: storyboard } = useActiveStoryboard(projectId);
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const setPendingTimelineAssetId = useStudioStore((s) => s.setPendingTimelineAssetId);
  const [nameDraft, setNameDraft] = useState("");
  const { data: playUrl } = useQuery({
    queryKey: ["asset-play", assetId],
    enabled: Boolean(assetId) && Boolean(data?.mimeType.startsWith("video/") || data?.mimeType.startsWith("audio/")),
    queryFn: () => apiFetch(`/api/v1/assets/${assetId}/download-url`) as Promise<{ url: string }>,
    staleTime: 60_000,
  });

  if (!assetId) return null;

  const scenes = storyboard?.payload.scenes ?? [];
  const firstScene = scenes[0];

  async function onDownload() {
    const { url } = (await apiFetch(`/api/v1/assets/${assetId}/download-url`)) as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg" data-testid="asset-detail-sheet">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{data?.originalName ?? "Asset"}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-4">
          {isLoading || !data ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <div className="space-y-4 pb-6">
              {data.mimeType.startsWith("video/") && playUrl?.url ? (
                <video src={playUrl.url} controls className="w-full rounded-lg border border-border" />
              ) : data.mimeType.startsWith("audio/") && playUrl?.url ? (
                <audio src={playUrl.url} controls className="w-full" />
              ) : (
                <AssetPreviewThumb assetId={data.id} mimeType={data.mimeType} className="max-h-48" alt={data.originalName} />
              )}

              <div className="flex flex-wrap gap-1">
                {data.roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
                <Badge variant="outline">{data.status}</Badge>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Тип</dt>
                  <dd>{data.mimeType}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Размер</dt>
                  <dd>{formatBytes(data.sizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Разрешение</dt>
                  <dd>
                    {data.width && data.height ? `${data.width}×${data.height}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Длительность</dt>
                  <dd>{formatDuration(data.durationMs)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Источник</dt>
                  <dd>{data.source ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Создан</dt>
                  <dd>{new Date(data.createdAt).toLocaleString()}</dd>
                </div>
              </dl>

              {data.sceneIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">Сцены: {data.sceneIds.join(", ")}</p>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs">Переименовать</Label>
                <div className="flex gap-2">
                  <Input
                    value={nameDraft || data.originalName}
                    onChange={(e) => setNameDraft(e.target.value)}
                    data-testid="asset-rename-input"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={rename.isPending}
                    data-testid="asset-rename-save"
                    onClick={() =>
                      void rename.mutateAsync({
                        assetId: data.id,
                        originalName: nameDraft || data.originalName,
                      })
                    }
                  >
                    OK
                  </Button>
                </div>
              </div>

              <section>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Происхождение</p>
                {data.lineage.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Источник неизвестен</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {data.lineage.map((n) => (
                      <li key={`${n.assetId}-${n.depth}`}>
                        {n.relationType}: {n.originalName ?? n.assetId.slice(0, 8)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {data.versions.length > 1 ? (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Версии</p>
                  <ul className="text-xs">
                    {data.versions.map((v) => (
                      <li key={v.id}>
                        v{v.version} · {new Date(v.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void onDownload()} data-testid="asset-download">
                  <Download className="mr-1 h-3 w-3" /> Скачать
                </Button>
                {data.mimeType.startsWith("image/") && firstScene ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="asset-use-first-frame"
                      onClick={() =>
                        void patchScene.mutateAsync({
                          sceneId: firstScene.sceneId,
                          patch: { firstFrameAssetId: data.id, expectedRevision: firstScene.revision },
                        })
                      }
                    >
                      Первый кадр
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="asset-use-last-frame"
                      onClick={() =>
                        void patchScene.mutateAsync({
                          sceneId: firstScene.sceneId,
                          patch: { lastFrameAssetId: data.id, expectedRevision: firstScene.revision },
                        })
                      }
                    >
                      Последний кадр
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="asset-add-reference"
                      onClick={() =>
                        void attachRef.mutateAsync({ assetId: data.id, role: "GENERAL" })
                      }
                    >
                      В референсы
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="asset-add-style-reference"
                      onClick={() =>
                        void attachRef.mutateAsync({ assetId: data.id, role: "STYLE" })
                      }
                    >
                      STYLE ref
                    </Button>
                  </>
                ) : null}
                {data.mimeType.startsWith("video/") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="asset-add-to-timeline"
                    onClick={() => {
                      setPendingTimelineAssetId(data.id);
                      setSection("timeline");
                      onOpenChange(false);
                    }}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> В Timeline
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={del.isPending}
                  data-testid="asset-delete"
                  onClick={async () => {
                    try {
                      await del.mutateAsync(data.id);
                      onOpenChange(false);
                    } catch {
                      /* conflict shown via toast ideally */
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Удалить
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
