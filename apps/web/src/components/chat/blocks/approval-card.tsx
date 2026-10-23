"use client";

import type { ApprovalBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";
import { api } from "@/lib/api-client";
import { useStudioStore } from "@/store/studio-store";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof ApprovalBlockSchema>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ApprovalCard({ block, projectId }: { block: Block; projectId: string }) {
  const handleApproval = useStudioStore((s) => s.handleApproval);
  const { mode } = useStudioRuntimeMode();

  async function onAction(actionId: string) {
    const apiAction =
      actionId === "approve" ? "approve" : actionId === "reject" ? "reject" : "request-revision";
    const isRealApproval = mode === "REAL" && UUID_RE.test(block.approvalId);
    const meta = block as Block & { expectedVersion?: string; payloadHash?: string };
    if (isRealApproval && meta.expectedVersion && meta.payloadHash) {
      await api.approvals.decide(block.approvalId, apiAction, {
        expectedVersion: meta.expectedVersion,
        payloadHash: meta.payloadHash,
        idempotencyKey: crypto.randomUUID(),
      });
      return;
    }
    handleApproval(projectId, block.approvalId, actionId);
  }

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
              onClick={() => void onAction(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
