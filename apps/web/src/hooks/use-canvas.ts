"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CanvasQuoteResult, SaveCanvasInput, SceneCanvasView } from "@shotbro/contracts";
import { api, apiFetch } from "@/lib/api-client";

export const canvasKey = (projectId: string | undefined) => ["canvas", projectId] as const;

function hasActiveRuns(view: SceneCanvasView | undefined) {
  return Object.values(view?.runs ?? {}).some((list) => list.some((r) => r.status === "QUEUED" || r.status === "RUNNING"));
}

/** Canvas + scenes + run history. SSE `canvas.updated` refreshes it; polling is only a fallback while runs are active. */
export function useCanvas(projectId: string | undefined) {
  return useQuery({
    queryKey: canvasKey(projectId),
    enabled: Boolean(projectId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/canvas`) as Promise<SceneCanvasView>,
    refetchInterval: (q) => (hasActiveRuns(q.state.data as SceneCanvasView | undefined) ? 4000 : false),
  });
}

export function useSaveCanvas(projectId: string | undefined) {
  return useMutation({
    mutationFn: (body: SaveCanvasInput) =>
      apiFetch(`/api/v1/projects/${projectId}/canvas`, { method: "PUT", body: JSON.stringify(body) }) as Promise<{
        documentId: string;
        version: number;
      }>,
  });
}

export function useQuoteCanvas(projectId: string | undefined) {
  return useMutation({
    mutationFn: (nodeIds: string[]) =>
      apiFetch(`/api/v1/projects/${projectId}/canvas/quote`, {
        method: "POST",
        body: JSON.stringify({ nodeIds }),
      }) as Promise<CanvasQuoteResult>,
  });
}

/** Approving the card makes the server create the jobs (same approval as the card in the chat). */
export function useConfirmCanvasQuote(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (q: CanvasQuoteResult) =>
      api.approvals.decide(q.approvalId, "approve", {
        expectedVersion: q.targetVersion,
        payloadHash: q.payloadHash,
        idempotencyKey: `canvas-ui:${q.approvalId}`,
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: canvasKey(projectId) });
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["approvals", projectId] });
    },
  });
}

export function useRejectCanvasQuote(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (q: CanvasQuoteResult) =>
      api.approvals.decide(q.approvalId, "reject", { expectedVersion: q.targetVersion, payloadHash: q.payloadHash }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["approvals", projectId] });
    },
  });
}
