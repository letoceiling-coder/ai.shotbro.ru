"use client";

import type { ErrorBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/store/studio-store";

type Block = z.infer<typeof ErrorBlockSchema>;

export function ErrorCard({ block, projectId }: { block: Block; projectId: string }) {
  const handleApproval = useStudioStore((s) => s.handleApproval);

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="border-destructive/50 text-destructive">
          Ошибка (DEMO)
        </Badge>
      </div>
      <p className="text-sm font-medium">{block.operation}</p>
      <p className="mt-1 text-sm text-muted-foreground">{block.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {block.retryActionId ? (
          <Button
            size="sm"
            onClick={() => handleApproval(projectId, "error", block.retryActionId!)}
          >
            Повторить
          </Button>
        ) : null}
        {block.reviseActionId ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleApproval(projectId, "error", block.reviseActionId!)}
          >
            Изменить параметры
          </Button>
        ) : null}
      </div>
    </div>
  );
}
