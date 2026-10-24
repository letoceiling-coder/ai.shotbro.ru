"use client";

import type { AgentActivityBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";

type Block = z.infer<typeof AgentActivityBlockSchema>;

export function AgentActivity({ block }: { block: Block }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
      <span className="font-medium">{block.label}</span>
      <Badge variant="demo">{block.simulationLabel}</Badge>
      <Badge variant="success">{block.status}</Badge>
      {block.goal ? <span className="w-full text-muted-foreground">{block.goal}</span> : null}
      {block.activeTools?.length ? (
        <span className="w-full text-xs text-muted-foreground">Tools: {block.activeTools.join(", ")}</span>
      ) : null}
    </div>
  );
}
