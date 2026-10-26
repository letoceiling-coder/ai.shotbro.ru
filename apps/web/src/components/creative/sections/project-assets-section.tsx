"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api-client";
import { useProjectAssets } from "@/hooks/use-creative-studio";
import { useRealUpload } from "@/hooks/use-real-upload";
import { WorkspaceState } from "./workspace-state";

function AssetPreview({ assetId, mimeType }: { assetId: string; mimeType: string }) {
  const { data } = useQuery({
    queryKey: ["asset-url", assetId],
    queryFn: () => apiFetch(`/api/v1/assets/${assetId}/download-url`) as Promise<{ url: string }>,
    enabled: mimeType.startsWith("image/") || mimeType.startsWith("video/"),
  });
  if (mimeType.startsWith("video/") && data?.url) {
    return <video src={data.url} className="max-h-32 w-full rounded-md" controls />;
  }
  if (mimeType.startsWith("image/") && data?.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={data.url} alt="" className="max-h-32 w-full rounded-md object-contain" />;
  }
  return <div className="rounded-md bg-muted px-3 py-6 text-center text-xs text-muted-foreground">{mimeType}</div>;
}

export function ProjectAssetsSection({ projectId }: { projectId: string }) {
  const { data: assets, isLoading, refetch } = useProjectAssets(projectId);
  const upload = useRealUpload(projectId);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading) return <WorkspaceState title="Assets" state="loading" />;

  const items = assets ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="project-assets">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div>
          <h2 className="text-sm font-semibold">Файлы проекта</h2>
          <p className="text-xs text-muted-foreground">MinIO · AssetService · привязка к проекту</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            await upload.mutateAsync(file);
            await refetch();
          }}
        />
        <Button
          size="sm"
          className="ml-auto"
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
          data-testid="asset-upload"
        >
          {upload.isPending ? "Загрузка…" : "Загрузить файл"}
        </Button>
      </header>
      <ScrollArea className="flex-1 p-3">
        {items.length === 0 ? (
          <WorkspaceState
            title="Библиотека пуста"
            state="empty"
            message="Загрузите референсы, изображения или другие материалы — они доступны в References и Storyboard."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                <AssetPreview assetId={a.id} mimeType={a.mimeType} />
                <p className="mt-2 truncate font-medium">{a.originalName ?? a.id}</p>
                <p className="text-xs text-muted-foreground">
                  {a.mimeType} · {a.status}
                </p>
                {"category" in a && (a as { category?: string }).category?.includes("mock") ? (
                  <Badge variant="demo" className="mt-1">
                    MOCK
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
