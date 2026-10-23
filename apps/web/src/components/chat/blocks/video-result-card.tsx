"use client";

import type { VideoResultBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, History, Sparkles } from "lucide-react";
import { ShotbroVideoPlayer } from "@/components/media/shotbro-video-player";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof VideoResultBlockSchema>;

export function VideoResultCard({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <StudioBlockCardBody className="pb-2 pt-3">
        <ShotbroVideoPlayer
          src={block.url}
          poster={block.posterUrl}
          aspectRatio={block.aspectRatio}
          className="max-w-[min(100%,320px)]"
        />
      </StudioBlockCardBody>
      <StudioBlockCardHeader
        title={block.title}
        aside={
          <Badge variant="demo" className="tabular-nums">
            v{block.version}
          </Badge>
        }
      />
      <StudioBlockCardBody className="space-y-3 pt-2">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Длительность</dt>
            <dd className="font-medium">{block.durationLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Формат</dt>
            <dd className="font-medium">{block.aspectRatio}</dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Разрешение</dt>
            <dd className="font-medium">{block.resolution}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <a href={block.url} download>
              <Download className="size-4" />
              Скачать MP4
            </a>
          </Button>
          <Button size="sm" variant="ghost">
            <Sparkles className="size-4" />
            Новая версия
          </Button>
          <Button size="sm" variant="ghost">
            <History className="size-4" />
            История
          </Button>
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
