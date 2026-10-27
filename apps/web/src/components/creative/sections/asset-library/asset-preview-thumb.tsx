"use client";

import { Film, FileAudio, FileIcon } from "lucide-react";
import { useAssetPreviewUrl } from "@/hooks/use-asset-library";
import { cn } from "@/lib/utils";

export function AssetPreviewThumb({
  assetId,
  mimeType,
  className,
  alt,
}: {
  assetId: string;
  mimeType: string;
  className?: string;
  alt?: string;
}) {
  const wantsPreview = mimeType.startsWith("image/") || mimeType.startsWith("video/");
  const { data, isLoading } = useAssetPreviewUrl(assetId, wantsPreview);

  if (mimeType.startsWith("audio/")) {
    return (
      <div className={cn("flex aspect-video items-center justify-center rounded-md bg-muted", className)}>
        <FileAudio className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (mimeType.startsWith("video/") && !data?.url) {
    return (
      <div className={cn("flex aspect-video items-center justify-center rounded-md bg-muted", className)}>
        <Film className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (data?.url && mimeType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data.url}
        alt={alt ?? ""}
        className={cn("aspect-video w-full rounded-md object-cover bg-muted", className)}
        loading="lazy"
      />
    );
  }

  if (data?.url && mimeType.startsWith("video/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data.url}
        alt={alt ?? "video poster"}
        className={cn("aspect-video w-full rounded-md object-cover bg-muted", className)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-video items-center justify-center rounded-md bg-muted text-xs text-muted-foreground",
        className,
      )}
    >
      {isLoading ? "…" : <FileIcon className="h-6 w-6" />}
    </div>
  );
}
