"use client";

import type { DeliveryBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";

type Block = z.infer<typeof DeliveryBlockSchema>;

export function DeliveryCard({ block }: { block: Block }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium">Финальный ролик</span>
        <Badge variant="demo">{block.mockLabel}</Badge>
        <Badge variant="secondary">{block.format.toUpperCase()}</Badge>
      </div>
      {block.url ? (
        <video src={block.url} controls className="mt-2 max-h-64 w-full rounded-md bg-black" playsInline />
      ) : (
        <p className="text-muted-foreground">Asset {block.assetId ?? "pending"}</p>
      )}
    </div>
  );
}
