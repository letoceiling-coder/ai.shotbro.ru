"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAssetPlaybackRef } from "@shotbro/contracts/asset-playback";
import { apiFetch } from "@/lib/api-client";

function resolveAssetId(assetId: string | undefined, url: string | undefined): string | undefined {
  if (assetId) return assetId;
  if (url) return parseAssetPlaybackRef(url) ?? undefined;
  return undefined;
}

/** Signed playback URL via preview-url (images/video) with download-url fallback. */
export function useAssetMediaUrl(assetId: string | undefined, url?: string) {
  const id = resolveAssetId(assetId, url);
  const needsFetch = Boolean(id && (!url || parseAssetPlaybackRef(url)));

  return useQuery({
    queryKey: ["asset-media-url", id],
    enabled: needsFetch,
    staleTime: 60_000,
    queryFn: async () => {
      if (!id) throw new Error("missing asset id");
      try {
        const preview = (await apiFetch(`/api/v1/assets/${id}/preview-url`)) as { url: string };
        if (preview.url) return { url: preview.url, kind: "preview" as const };
      } catch {
        /* fall through */
      }
      const dl = (await apiFetch(`/api/v1/assets/${id}/download-url`)) as { url: string };
      return { url: dl.url, kind: "download" as const };
    },
  });
}

export function resolveMediaSrc(
  block: { assetId?: string; url?: string },
  fetched?: { url: string },
): string {
  if (block.url && !parseAssetPlaybackRef(block.url)) return block.url;
  return fetched?.url ?? "";
}
