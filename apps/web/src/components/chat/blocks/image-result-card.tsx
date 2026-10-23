"use client";

import type { ImageResultBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Pencil, Sparkles } from "lucide-react";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof ImageResultBlockSchema>;

export function ImageResultCard({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[min(100%,280px)] bg-black/25">
        <Image
          src={block.url}
          alt={block.title}
          fill
          className="object-cover"
          sizes="(max-width:640px) 100vw, 280px"
          unoptimized
        />
      </div>
      <StudioBlockCardHeader
        title={block.title}
        aside={
          <Badge variant="demo" className="tabular-nums">
            v{block.version}
          </Badge>
        }
      />
      <StudioBlockCardBody className="space-y-3 pt-2">
        <p className="text-xs text-muted-foreground">{block.format}</p>
        {block.params ? (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(block.params).map(([k, v]) => (
              <Badge key={k} variant="secondary" className="font-normal">
                {k}: {v}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <a href={block.url} download>
              <Download className="size-4" />
              Скачать
            </a>
          </Button>
          <Button size="sm" variant="ghost">
            <Pencil className="size-4" />
            Редактировать
          </Button>
          <Button size="sm" variant="ghost">
            <Sparkles className="size-4" />
            Новая версия
          </Button>
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
