"use client";

import type { VersionHistoryBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Block = z.infer<typeof VersionHistoryBlockSchema>;

export function VersionHistoryCard({ block }: { block: Block }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--sb-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{block.title}</h3>
        <Badge variant="demo">DEMO</Badge>
      </div>
      <ul className="space-y-2">
        {block.items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-2",
              item.id === block.activeVersionId ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            {item.previewUrl ? (
              <div className="relative size-12 shrink-0 overflow-hidden rounded-md">
                <Image src={item.previewUrl} alt="" fill className="object-cover" sizes="48px" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                v{item.version} · {item.label}
              </p>
              <p className="text-xs text-muted-foreground">{item.createdAtLabel}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
