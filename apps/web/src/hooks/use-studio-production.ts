"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiFetch } from "@/lib/api-client";
import type { QualityStrategy } from "@shotbro/contracts";

export function useModelCatalog() {
  return useQuery({
    queryKey: ["model-catalog"],
    queryFn: () =>
      apiFetch("/api/v1/providers/model-catalog") as Promise<{
        models: Array<{
          modelId: string;
          provider: string;
          displayName: string;
          supportedOperations: string[];
          priceStatus: string;
          executionStatus: string;
        }>;
        liveExecutionBlocked: boolean;
      }>,
    staleTime: 60_000,
  });
}

export function useAgentRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: ["agent-runs", projectId],
    enabled: Boolean(projectId),
    queryFn: () => api.agent.listRuns(projectId!),
    refetchInterval: 5_000,
  });
}

export function useAgentRunTrace(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: ["agent-trace", projectId, runId],
    enabled: Boolean(projectId && runId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/agent/runs/${runId}/trace`),
    refetchInterval: 4_000,
  });
}

export function useProviderJobs(projectId: string | undefined) {
  return useQuery({
    queryKey: ["provider-jobs", projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/provider-jobs`),
    refetchInterval: 6_000,
  });
}

export function useProductionGraph(projectId: string | undefined, runId?: string) {
  return useQuery({
    queryKey: ["production-graph", projectId, runId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiFetch(
        `/api/v1/projects/${projectId}/production-graph${runId ? `?runId=${encodeURIComponent(runId)}` : ""}`,
      ),
    refetchInterval: 5_000,
  });
}

export function useProjectDetail(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}`),
  });
}

export type ProjectModelSettings = {
  qualityStrategy: QualityStrategy | "manual";
  manualModels?: Record<string, string>;
};

export function usePatchProjectSettings(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      apiFetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ settings }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export function readProjectModelSettings(settings: unknown): ProjectModelSettings {
  const s = (settings ?? {}) as { qualityStrategy?: QualityStrategy; manualModels?: Record<string, string> };
  return {
    qualityStrategy: s.qualityStrategy ?? "balance",
    manualModels: s.manualModels,
  };
}
