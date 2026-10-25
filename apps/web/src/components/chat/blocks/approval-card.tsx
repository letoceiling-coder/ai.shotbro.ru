"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { ApprovalBlockSchema } from "@shotbro/contracts";
import { useState } from "react";
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
  const qc = useQueryClient();
  const [status, setStatus] = useState(block.status);
  const [pending, setPending] = useState(false);

  async function onAction(actionId: string) {
    const apiAction =
      actionId === "approve" ? "approve" : actionId === "reject" ? "reject" : "request-revision";
    const isRealApproval = mode === "REAL" && UUID_RE.test(block.approvalId);
    const meta = block as Block & { expectedVersion?: string; payloadHash?: string };
    if (isRealApproval && meta.expectedVersion && meta.payloadHash) {
      setPending(true);
      try {
        const res = (await api.approvals.decide(block.approvalId, apiAction, {
          expectedVersion: meta.expectedVersion,
          payloadHash: meta.payloadHash,
          idempotencyKey: crypto.randomUUID(),
        })) as { status?: string };
        const next =
          res.status === "APPROVED"
            ? "approved"
            : res.status === "REJECTED"
              ? "rejected"
              : res.status === "REQUIRES_REVISION"
                ? "revision"
                : status;
        setStatus(next as Block["status"]);
        await qc.invalidateQueries({ queryKey: ["messages"] });
        await qc.invalidateQueries({ queryKey: ["approvals", projectId] });
        await qc.invalidateQueries({ queryKey: ["agent-runs", projectId] });
        setTimeout(() => qc.invalidateQueries({ queryKey: ["messages"] }), 800);
      } finally {
        setPending(false);
      }
      return;
    }
    handleApproval(projectId, block.approvalId, actionId);
  }

  const displayStatus = status;

  return (
    <div data-testid="approval-card" data-approval-status={displayStatus}>
    <StudioBlockCard accent>
      <StudioBlockCardHeader title={block.title} />
      <StudioBlockCardBody className="space-y-3">
        {block.description ? (
          <p className="text-sm text-muted-foreground">{block.description}</p>
        ) : null}
        {displayStatus !== "pending" ? (
          <Badge variant={displayStatus === "approved" ? "default" : "secondary"}>
            {displayStatus === "approved"
              ? "Утверждено"
              : displayStatus === "rejected"
                ? "Отклонено"
                : "Нужны правки"}
          </Badge>
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
              disabled={pending || displayStatus !== "pending"}
              onClick={() => void onAction(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
    </div>
  );
}
