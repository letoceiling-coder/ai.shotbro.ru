"use client";

import type { AudioResultBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Mic } from "lucide-react";

type Block = z.infer<typeof AudioResultBlockSchema>;

export function AudioResultCard({ block }: { block: Block }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--sb-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{block.title}</h3>
        <Badge variant="demo">DEMO v{block.version}</Badge>
      </div>
      <audio controls className="w-full" preload="metadata" src={block.url}>
        Ваш браузер не поддерживает аудио.
      </audio>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Длительность</dt>
          <dd className="font-medium">{block.durationLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Голос</dt>
          <dd className="font-medium">{block.voiceLabel}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" asChild>
          <a href={block.url} download>
            <Download className="size-4" />
            Скачать
          </a>
        </Button>
        <Button size="sm" variant="ghost">
          <Mic className="size-4" />
          Заменить голос
        </Button>
      </div>
    </div>
  );
}
