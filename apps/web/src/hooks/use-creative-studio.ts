"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CharacterProfile, ReferenceLink, StoryboardScene } from "@shotbro/contracts";
import { parseStoryboardDocument, type StoryboardDocument } from "@shotbro/contracts";

export type StoryboardRow = {
  id: string;
  version: number;
  payload: ReturnType<typeof parseStoryboardDocument>;
};

export function useProjectAssets(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-assets", projectId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/assets`) as Promise<
        Array<{ id: string; mimeType: string; originalName?: string; status: string }>
      >,
  });
}

export function useActiveStoryboard(projectId: string | undefined) {
  return useQuery({
    queryKey: ["storyboard", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const row = (await apiFetch(`/api/v1/projects/${projectId}/storyboard`)) as StoryboardRow | null;
      if (!row || !row.payload) return null;
      return { ...row, payload: parseStoryboardDocument(row.payload) };
    },
    retry: (count, err) => {
      if (String(err).includes("404")) return false;
      return count < 2;
    },
  });
}

export function useSyncStoryboard(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/api/v1/projects/${projectId}/storyboard/sync`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storyboard", projectId] }),
  });
}

export function usePatchStoryboardScene(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sceneId,
      patch,
    }: {
      sceneId: string;
      patch: Partial<StoryboardScene> & { expectedRevision?: number };
    }) =>
      apiFetch(`/api/v1/projects/${projectId}/storyboard/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storyboard", projectId] }),
  });
}

export function useReorderStoryboard(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sceneIds: string[]) =>
      apiFetch(`/api/v1/projects/${projectId}/storyboard/scenes/reorder`, {
        method: "POST",
        body: JSON.stringify({ sceneIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storyboard", projectId] }),
  });
}

export function useCharacters(projectId: string | undefined) {
  return useQuery({
    queryKey: ["characters", projectId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/characters`) as Promise<{ items: CharacterProfile[] }>,
  });
}

export function useUpsertCharacter(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CharacterProfile> & { name: string; expectedVersion?: number }) =>
      apiFetch(`/api/v1/projects/${projectId}/characters`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      qc.invalidateQueries({ queryKey: ["storyboard", projectId] });
    },
  });
}

export function useAssignCharacterScene(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      characterId,
      sceneId,
      characterVersion,
    }: {
      characterId: string;
      sceneId: string;
      characterVersion?: number;
    }) =>
      apiFetch(`/api/v1/projects/${projectId}/characters/${characterId}/assign-scene`, {
        method: "POST",
        body: JSON.stringify({ sceneId, characterVersion }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      qc.invalidateQueries({ queryKey: ["storyboard", projectId] });
    },
  });
}

export function useRestoreCharacter(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, version }: { characterId: string; version: number }) =>
      apiFetch(`/api/v1/projects/${projectId}/characters/${characterId}/restore`, {
        method: "POST",
        body: JSON.stringify({ version }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters", projectId] }),
  });
}

export function useReferences(projectId: string | undefined, filter?: { sceneId?: string; characterId?: string }) {
  const qs = new URLSearchParams();
  if (filter?.sceneId) qs.set("sceneId", filter.sceneId);
  if (filter?.characterId) qs.set("characterId", filter.characterId);
  const q = qs.toString();
  return useQuery({
    queryKey: ["references", projectId, filter?.sceneId, filter?.characterId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/references${q ? `?${q}` : ""}`) as Promise<{ items: ReferenceLink[] }>,
  });
}

export function useAttachReference(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      assetId: string;
      role?: string;
      sceneId?: string;
      characterId?: string;
      idempotencyKey?: string;
    }) =>
      apiFetch(`/api/v1/projects/${projectId}/references`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["references", projectId] }),
  });
}

export function useDetachReference(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiFetch(`/api/v1/projects/${projectId}/references/${linkId}/detach`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["references", projectId] }),
  });
}

export type { StoryboardDocument, StoryboardScene };
