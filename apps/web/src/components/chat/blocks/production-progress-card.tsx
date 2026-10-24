"use client";

import type { ProductionProgressBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Progress } from "@/components/ui/progress";

type Block = z.infer<typeof ProductionProgressBlockSchema>;

export function ProductionProgressCard({ block }: { block: Block }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 text-sm">
      <div className="mb-2 font-medium">{block.stage}</div>
      {block.message ? <p className="mb-2 text-muted-foreground">{block.message}</p> : null}
      <Progress value={block.percent} className="h-2" />
      <p className="mt-1 text-xs text-muted-foreground">
        {block.percent}% · run {block.runId.slice(0, 8)}…
        {block.traceId ? ` · trace ${block.traceId.slice(0, 8)}…` : ""}
      </p>
    </div>
  );
}
