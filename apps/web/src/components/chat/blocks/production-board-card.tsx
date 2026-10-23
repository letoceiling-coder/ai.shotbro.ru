"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProductionBoardBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof ProductionBoardBlockSchema>;

type GraphNode = { id: string; nodeType: string; status: string };

export function ProductionBoardCard({ block, projectId }: { block: Block; projectId: string }) {
  const { data } = useQuery({
    queryKey: ["production-graph", projectId, block.runId],
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/production-graph?runId=${block.runId}`) as Promise<{
      items: GraphNode[];
    }>,
    refetchInterval: 4000,
  });

  const nodes = data?.items?.filter((n) => n.id.startsWith(block.runId)) ?? [];
  const completed = nodes.filter((n) => n.status === "COMPLETED").length;
  const failed = nodes.some((n) => n.status === "FAILED");

  return (
    <StudioBlockCard>
      <StudioBlockCardHeader
        title={block.title}
        aside={
          <Badge variant="secondary">
            {nodes.length ? `${completed}/${nodes.length}` : "…"}
          </Badge>
        }
      />
      <StudioBlockCardBody className="space-y-2">
        {block.stages.map((stage) => (
          <div key={stage.id} className="flex items-center justify-between text-sm">
            <span>{stage.label}</span>
            <Badge variant={stage.status === "COMPLETED" ? "default" : "outline"}>{stage.status}</Badge>
          </div>
        ))}
        {nodes.length ? (
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {nodes.slice(0, 12).map((n) => (
              <li key={n.id}>
                {n.nodeType}: {n.status}
              </li>
            ))}
          </ul>
        ) : null}
        {failed ? <p className="text-sm text-destructive">Есть ошибки в графе — см. логи worker.</p> : null}
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
