"use client";

import type { ToolExecutionBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Block = z.infer<typeof ToolExecutionBlockSchema>;

export function ToolExecutionCard({ block }: { block: Block }) {
  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="font-medium">{block.toolName}</span>
        <Badge variant="demo">{block.simulationLabel ?? "Симуляция процесса"}</Badge>
      </div>
      <p className="text-muted-foreground">{block.message}</p>
    </div>
  );
}
