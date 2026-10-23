"use client";

import type { CostEstimateBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof CostEstimateBlockSchema>;

export function CostEstimateCard({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <StudioBlockCardHeader
        title={block.title}
        aside={<Badge variant="demo">симуляция</Badge>}
      />
      <StudioBlockCardBody>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{block.disclaimer}</p>
        <ul className="space-y-1.5 text-sm">
          {block.lines.map((line) => (
            <li key={line.label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{line.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{line.amountLabel}</span>
            </li>
          ))}
        </ul>
        <Separator className="my-3" />
        <div className="flex justify-between text-sm font-semibold">
          <span>Итого</span>
          <span className="tabular-nums">{block.totalLabel}</span>
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
