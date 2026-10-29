"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { AssetSummary } from "@shotbro/contracts";
import { Grid2X2, LayoutList, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetLibrary, type AssetLibraryFilters } from "@/hooks/use-asset-library";
import { useRealUpload } from "@/hooks/use-real-upload";
import { WorkspaceState } from "../workspace-state";
import { AssetPreviewThumb } from "./asset-preview-thumb";
import { AssetDetailSheet } from "./asset-detail-sheet";

const FILTERS = [
  { id: "all", label: "Все файлы" },
  { id: "upload", label: "Загруженные" },
  { id: "image", label: "Изображения" },
  { id: "video", label: "Видео" },
  { id: "audio", label: "Аудио" },
  { id: "reference", label: "Референсы" },
  { id: "first_frame", label: "Первые кадры" },
  { id: "last_frame", label: "Последние кадры" },
  { id: "generation", label: "Генерации" },
  { id: "final", label: "Финальные ролики" },
] as const;

export function AssetLibraryView({ projectId }: { projectId: string }) {
  const [filters, setFilters] = useState<AssetLibraryFilters>({
    q: "",
    filter: "all",
    sort: "created_desc",
    view: "grid",
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadInputId = useId();
  const upload = useRealUpload(projectId);
  const { data, isLoading, isFetching, refetch } = useAssetLibrary(projectId, filters, cursor);
  const filterKey = `${filters.q}\u0000${filters.filter}\u0000${filters.sort}`;
  // Items are tagged with the filter set they belong to. A reset effect on mount used to wipe
  // cached data (React Query keeps the same reference), leaving "Библиотека пуста" for READY assets.
  const [loaded, setLoaded] = useState<{ key: string; items: AssetSummary[] }>({ key: filterKey, items: [] });

  useEffect(() => {
    if (!data?.items) return;
    const page = data.items;
    setLoaded((prev) => {
      if (!cursor || prev.key !== filterKey) return { key: filterKey, items: page };
      const known = new Set(prev.items.map((a) => a.id));
      return { key: filterKey, items: [...prev.items, ...page.filter((a) => !known.has(a.id))] };
    });
  }, [data?.items, cursor, filterKey]);

  useEffect(() => {
    setCursor(null);
  }, [filterKey]);

  const items = loaded.key === filterKey ? loaded.items : [];

  const onDrop = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files];
      for (const file of list) {
        await upload.mutateAsync(file);
      }
      setCursor(null);
      await refetch();
    },
    [upload, refetch],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="asset-library"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void onDrop(e.dataTransfer.files);
      }}
    >
      <header className="space-y-3 border-b border-border bg-gradient-to-b from-muted/30 to-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Asset Library</h2>
            <p className="text-xs text-muted-foreground">REAL · MinIO · подписанные превью</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant={filters.view === "grid" ? "default" : "outline"}
              onClick={() => setFilters((f) => ({ ...f, view: "grid" }))}
              aria-label="Сетка"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={filters.view === "list" ? "default" : "outline"}
              onClick={() => setFilters((f) => ({ ...f, view: "list" }))}
              aria-label="Список"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <input
              ref={fileRef}
              id={uploadInputId}
              type="file"
              multiple
              className="sr-only"
              data-testid="asset-library-file-input"
              onChange={(e) => {
                const files = e.target.files;
                e.target.value = "";
                if (files?.length) void onDrop(files);
              }}
            />
            <Button size="sm" disabled={upload.isPending} data-testid="asset-upload" asChild>
              <label htmlFor={uploadInputId} className="cursor-pointer">
                <Upload className="mr-1 h-4 w-4" />
                {upload.isPending ? `Загрузка ${upload.progressPct ?? 0}%` : "Загрузить"}
              </label>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Поиск по имени…"
              value={filters.q}
              data-testid="asset-library-search"
              onChange={(e) => {
                setCursor(null);
                setFilters((f) => ({ ...f, q: e.target.value }));
              }}
            />
          </div>
          <Select
            value={filters.filter}
            onValueChange={(v) => {
              setCursor(null);
              setFilters((f) => ({ ...f, filter: v }));
            }}
          >
            <SelectTrigger className="w-[180px]" data-testid="asset-library-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sort}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                sort: v as AssetLibraryFilters["sort"],
              }))
            }
          >
            <SelectTrigger className="w-[160px]" data-testid="asset-library-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Новые первые</SelectItem>
              <SelectItem value="created_asc">Старые первые</SelectItem>
              <SelectItem value="name_asc">Имя A→Z</SelectItem>
              <SelectItem value="size_desc">Размер ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <WorkspaceState
            title="Библиотека пуста"
            state="empty"
            message="Перетащите файлы сюда или нажмите «Загрузить». После обработки они появятся с превью."
          />
        ) : filters.view === "grid" ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="asset-library-grid">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="group w-full rounded-xl border border-border bg-card p-2 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
                  data-testid={`asset-card-${a.id}`}
                  onClick={() => {
                    setSelectedId(a.id);
                    setDetailOpen(true);
                  }}
                >
                  <AssetPreviewThumb assetId={a.id} mimeType={a.mimeType} alt={a.originalName} />
                  <p className="mt-2 truncate text-sm font-medium">{a.originalName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.roles.slice(0, 3).map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{a.mimeType}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border" data-testid="asset-library-list">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  data-testid={`asset-row-${a.id}`}
                  onClick={() => {
                    setSelectedId(a.id);
                    setDetailOpen(true);
                  }}
                >
                  <div className="w-24 shrink-0">
                    <AssetPreviewThumb assetId={a.id} mimeType={a.mimeType} className="aspect-video" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.originalName}</p>
                    <p className="text-xs text-muted-foreground">{a.source}</p>
                  </div>
                  <Badge variant="secondary">{a.status}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}

        {data?.nextCursor ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              data-testid="asset-library-load-more"
              onClick={() => setCursor(data.nextCursor ?? null)}
            >
              Ещё
            </Button>
          </div>
        ) : null}
      </ScrollArea>

      <AssetDetailSheet
        projectId={projectId}
        assetId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
