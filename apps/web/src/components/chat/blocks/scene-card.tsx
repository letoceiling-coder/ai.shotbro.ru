"use client";

import type { StoryboardBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Scene = z.infer<typeof StoryboardBlockSchema>["scenes"][number];

const statusLabel = {
  completed: "Готово",
  active: "В работе",
  pending: "Ожидает",
  failed: "Ошибка",
  canceled: "Отменено",
} as const;

export function SceneCard({ scene }: { scene: Scene }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-border bg-background/30 p-2 text-left transition-colors hover:border-primary/40 hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative mb-2 aspect-video overflow-hidden rounded-md bg-black/20">
        <Image src={scene.thumbnailUrl} alt={scene.title} fill className="object-cover" sizes="240px" unoptimized />
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-medium">{scene.title}</p>
        <Badge
          variant={scene.status === "completed" ? "success" : "secondary"}
          className={cn(scene.status === "active" && "border-primary/40 text-primary")}
        >
          {statusLabel[scene.status]}
        </Badge>
      </div>
      {scene.durationLabel ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{scene.durationLabel}</p>
      ) : null}
    </button>
  );
}
