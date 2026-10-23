"use client";

import { cn } from "@/lib/utils";

export function ShotbroVideoPlayer({
  src,
  poster,
  aspectRatio = "9:16",
  className,
}: {
  src: string;
  poster?: string;
  aspectRatio?: string;
  className?: string;
}) {
  const isVertical = aspectRatio.startsWith("9:");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-black",
        isVertical ? "mx-auto max-w-[320px]" : "w-full",
        className,
      )}
    >
      <video
        controls
        playsInline
        preload="metadata"
        poster={poster}
        src={src}
        className={cn("w-full bg-black", isVertical ? "aspect-[9/16]" : "aspect-video")}
      >
        Ваш браузер не поддерживает воспroизведение видео.
      </video>
    </div>
  );
}
