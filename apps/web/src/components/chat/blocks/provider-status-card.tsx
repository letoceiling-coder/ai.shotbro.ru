"use client";

import type { ProviderStatusBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";

type Block = z.infer<typeof ProviderStatusBlockSchema>;

export function ProviderStatusCard({ block }: { block: Block }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium">Provider job</span>
        <Badge variant="demo">{block.mockLabel}</Badge>
        <Badge variant="secondary">{block.status}</Badge>
      </div>
      <dl className="grid gap-1 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline">Provider: </dt>
          <dd className="inline text-foreground">{block.providerId}</dd>
        </div>
        <div>
          <dt className="inline">Model: </dt>
          <dd className="inline text-foreground">{block.modelId}</dd>
        </div>
        <div>
          <dt className="inline">Operation: </dt>
          <dd className="inline text-foreground">{block.operation}</dd>
        </div>
        <div className="break-all">
          <dt className="inline">Job: </dt>
          <dd className="inline font-mono text-xs text-foreground">{block.providerJobId}</dd>
        </div>
      </dl>
    </div>
  );
}
