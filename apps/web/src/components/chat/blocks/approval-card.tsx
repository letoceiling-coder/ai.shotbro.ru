"use client";

import type { ApprovalBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/store/studio-store";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof ApprovalBlockSchema>;

export function ApprovalCard({ block, projectId }: { block: Block; projectId: string }) {
  const handleApproval = useStudioStore((s) => s.handleApproval);

  return (
    <StudioBlockCard accent>
      <StudioBlockCardHeader title={block.title} />
      <StudioBlockCardBody className="space-y-3">
        {block.description ? (
          <p className="text-sm text-muted-foreground">{block.description}</p>
        ) : null}
        {block.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {block.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {block.actions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={
                action.variant === "primary"
                  ? "default"
                  : action.variant === "ghost"
                    ? "ghost"
                    : "secondary"
              }
              disabled={block.status === "approved" && action.id === "approve"}
              onClick={() => handleApproval(projectId, block.approvalId, action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
