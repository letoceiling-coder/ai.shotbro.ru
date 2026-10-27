"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetDetail, AssetSummary } from "@shotbro/contracts";
import { apiFetch } from "@/lib/api-client";

export type AssetLibraryFilters = {
  q: string;
  filter: string;
  sort: "created_desc" | "created_asc" | "name_asc" | "size_desc";
  view: "grid" | "list";
};

export function useAssetLibrary(
  projectId: string | undefined,
  filters: AssetLibraryFilters,
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  params.set("limit", "24");
  if (cursor) params.set("cursor", cursor);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.filter && filters.filter !== "all") params.set("filter", filters.filter);
  if (filters.sort) params.set("sort", filters.sort);

  return useQuery({
    queryKey: ["asset-library", projectId, filters.q, filters.filter, filters.sort, cursor],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/assets?${params}`) as Promise<{
        items: AssetSummary[];
        nextCursor?: string | null;
      }>,
  });
}

export function useAssetDetail(assetId: string | undefined) {
  return useQuery({
    queryKey: ["asset-detail", assetId],
    enabled: Boolean(assetId),
    queryFn: () => apiFetch(`/api/v1/assets/${assetId}`) as Promise<AssetDetail>,
  });
}

export function useAssetPreviewUrl(assetId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["asset-preview", assetId],
    enabled: Boolean(assetId) && enabled,
    queryFn: async () => {
      try {
        return (await apiFetch(`/api/v1/assets/${assetId}/preview-url`)) as { url: string; kind: string };
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
}

export function useRenameAsset(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, originalName }: { assetId: string; originalName: string }) =>
      apiFetch(`/api/v1/assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify({ originalName }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-library", projectId] });
      qc.invalidateQueries({ queryKey: ["project-assets", projectId] });
    },
  });
}

export function useDeleteAsset(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) =>
      apiFetch(`/api/v1/assets/${assetId}/delete`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-library", projectId] });
      qc.invalidateQueries({ queryKey: ["project-assets", projectId] });
    },
  });
}
