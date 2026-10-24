"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ScriptDocument } from "@shotbro/contracts";

type ScriptRow = {
  id: string;
  version: number;
  payload: ScriptDocument;
};

export function useActiveScript(projectId: string | undefined) {
  return useQuery({
    queryKey: ["script", projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/script`) as Promise<ScriptRow>,
    retry: (count, err) => {
      if (String(err).includes("404")) return false;
      return count < 2;
    },
  });
}

export function useActiveBrief(projectId: string | undefined) {
  return useQuery({
    queryKey: ["brief", projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/brief`),
    retry: (count, err) => {
      if (String(err).includes("404")) return false;
      return count < 2;
    },
  });
}

export function usePatchScriptScene(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sceneId,
      patch,
    }: {
      sceneId: string;
      patch: Record<string, unknown> & { expectedRevision?: number };
    }) =>
      apiFetch(`/api/v1/projects/${projectId}/scripts/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["script", projectId] }),
  });
}

export function useScriptSceneMutations(projectId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["script", projectId] });

  const addScene = useMutation({
    mutationFn: (body: { afterSceneId?: string; title?: string }) =>
      apiFetch(`/api/v1/projects/${projectId}/scripts/scenes`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const deleteScene = useMutation({
    mutationFn: (sceneId: string) =>
      apiFetch(`/api/v1/projects/${projectId}/scripts/scenes/${sceneId}/delete`, { method: "POST", body: "{}" }),
    onSuccess: invalidate,
  });

  const duplicateScene = useMutation({
    mutationFn: (sceneId: string) =>
      apiFetch(`/api/v1/projects/${projectId}/scripts/scenes/${sceneId}/duplicate`, { method: "POST", body: "{}" }),
    onSuccess: invalidate,
  });

  const reorderScenes = useMutation({
    mutationFn: (sceneIds: string[]) =>
      apiFetch(`/api/v1/projects/${projectId}/scripts/scenes/reorder`, {
        method: "POST",
        body: JSON.stringify({ sceneIds }),
      }),
    onSuccess: invalidate,
  });

  return { addScene, deleteScene, duplicateScene, reorderScenes };
}
