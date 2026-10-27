"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api-client";
import { useProjectAssets } from "@/hooks/use-creative-studio";
import { useRealUpload } from "@/hooks/use-real-upload";
import { cn } from "@/lib/utils";

function AssetThumb({ assetId, mimeType }: { assetId: string; mimeType: string }) {
  const { data } = useQuery({
    queryKey: ["asset-url", assetId],
    queryFn: async () => {
      try {
        return (await apiFetch(`/api/v1/assets/${assetId}/preview-url`)) as { url: string };
      } catch {
        return (await apiFetch(`/api/v1/assets/${assetId}/download-url`)) as { url: string };
      }
    },
    enabled: mimeType.startsWith("image/"),
  });
  if (!data?.url) {
    return <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-[10px]">asset</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.url} alt="" className="h-16 w-16 rounded-md object-cover" />
  );
}

export function AssetPickerDialog({
  projectId,
  open,
  onOpenChange,
  onPick,
  accept = "image/*",
  title = "Выберите asset",
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (assetId: string) => void;
  accept?: string;
  title?: string;
}) {
  const { data: assets, isLoading } = useProjectAssets(projectId);
  const upload = useRealUpload(projectId);
  const fileRef = useRef<HTMLInputElement>(null);
  const images = (assets ?? []).filter((a) => a.status === "READY" && a.mimeType.startsWith("image/"));

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    const assetId = await upload.mutateAsync(file);
    onPick(assetId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="asset-picker-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => void onFileChange(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
            data-testid="asset-picker-upload"
          >
            {upload.isPending ? "Загрузка…" : "Загрузить файл"}
          </Button>
        </div>
        <ScrollArea className="max-h-72">
          {isLoading ? <p className="text-sm text-muted-foreground">Загрузка библиотеки…</p> : null}
          <div className="grid grid-cols-3 gap-2 p-1">
            {images.map((a) => (
              <button
                key={a.id}
                type="button"
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-left hover:bg-muted/60",
                )}
                data-testid={`asset-pick-${a.id}`}
                onClick={() => {
                  onPick(a.id);
                  onOpenChange(false);
                }}
              >
                <AssetThumb assetId={a.id} mimeType={a.mimeType} />
                <span className="line-clamp-2 w-full text-[10px] text-muted-foreground">{a.originalName ?? a.id.slice(0, 8)}</span>
              </button>
            ))}
          </div>
          {!isLoading && images.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Нет готовых изображений — загрузите файл.</p>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
