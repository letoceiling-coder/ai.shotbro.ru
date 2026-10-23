"use client";

import type { ModelComparisonBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof ModelComparisonBlockSchema>;

export function ModelComparisonCard({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <StudioBlockCardHeader title={block.title} />
      <StudioBlockCardBody>
        <div className="grid gap-2 sm:grid-cols-2">
          {block.models.map((model) => (
            <div
              key={model.id}
              className={cn(
                "rounded-lg border p-3 text-sm transition-colors",
                model.id === block.selectedId
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/70 bg-background/20",
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{model.name}</p>
                {model.recommended ? (
                  <Badge variant="default" className="text-[10px]">
                    Рек.
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{model.provider}</p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Качество</dt>
                  <dd className="text-right">{model.quality}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Скорость</dt>
                  <dd>{model.speed}</dd>
                </div>
                <div className="flex justify-between gap-2 font-medium">
                  <dt className="text-muted-foreground">Стоимость</dt>
                  <dd className="tabular-nums">{model.costLabel}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
