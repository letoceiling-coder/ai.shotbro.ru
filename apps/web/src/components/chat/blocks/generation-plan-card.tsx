"use client";

import type { GenerationPlanBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof GenerationPlanBlockSchema>;

const statusIcon = {
  completed: CheckCircle2,
  active: Loader2,
  pending: Circle,
  failed: XCircle,
  canceled: XCircle,
} as const;

export function GenerationPlanCard({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <StudioBlockCardHeader title={block.title} />
      <StudioBlockCardBody className="py-2.5">
        <ol className="space-y-1.5">
          {block.steps.map((step) => {
            const Icon = statusIcon[step.status];
            return (
              <li key={step.id} className="flex items-start gap-2.5 text-sm">
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    step.status === "completed" && "text-[var(--sb-success)]",
                    step.status === "active" && "text-primary animate-spin",
                    step.status === "pending" && "text-muted-foreground",
                    step.status === "failed" && "text-destructive",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{step.label}</p>
                  {step.detail ? (
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
