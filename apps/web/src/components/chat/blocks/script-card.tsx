"use client";

import type { ScriptBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof ScriptBlockSchema>;

export function ScriptCard({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <StudioBlockCardHeader
        title={block.title}
        aside={<Badge variant="secondary">{block.durationLabel}</Badge>}
      />
      <StudioBlockCardBody className="space-y-2">
        {block.scenes.map((scene) => (
          <div
            key={scene.id}
            className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{scene.title}</span>
              <span>{scene.timeRange}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{scene.description}</p>
          </div>
        ))}
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
