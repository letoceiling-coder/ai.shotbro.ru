"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessage } from "@shotbro/contracts";
import { api, apiFetch } from "@/lib/api-client";
import { resolveStudioMessageIntent } from "@/lib/agent-message-routing";
import { authClient } from "@/lib/auth-client";

export function useAuthSession() {
  return authClient.useSession();
}

export function useRealProjects() {
  return useQuery({
    queryKey: ["real-projects"],
    queryFn: () => api.projects.list(),
  });
}

export function useRealProjectConversations(projectId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/conversations`),
    staleTime: 5_000,
  });
}

/** Creates default conversation when project has none (legacy or failed txn). */
export function useEnsureDefaultConversation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/conversations`, {
        method: "POST",
        body: JSON.stringify({ title: "Основной диалог" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", projectId] }),
  });
}

export function useRealMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => apiFetch(`/api/v1/conversations/${conversationId}/messages`),
  });
}

export function useCreateRealProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; settings?: Record<string, unknown> }) =>
      api.projects.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["real-projects"] }),
  });
}

export function useSendRealMessage(conversationId: string | undefined, projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const msg = await apiFetch(`/api/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, role: "user", idempotencyKey: crypto.randomUUID() }),
      });
      if (projectId && conversationId) {
        try {
          const intent = resolveStudioMessageIntent(content);
          if (intent === "production_bootstrap" || intent === "production_default") {
            await api.agent.createRun(projectId, { userRequest: content, conversationId });
          } else {
            const idempotencyKey = crypto.randomUUID();
            const creative = await api.agent.creativeTurn(projectId, {
              userMessage: content,
              conversationId,
              idempotencyKey,
            });
            if (creative.status === "no_intent") {
              await api.agent.createRun(projectId, { userRequest: content, conversationId });
            }
          }
        } catch {
          /* agent may stop at approval — still ok */
        }
      }
      return msg;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["agent-runs", projectId] });
    },
  });
}

type RealMessageItem = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  blocks?: Array<{ type: string; [key: string]: unknown }>;
  attachments?: Array<{ assetId: string }>;
};

export function mapRealMessagesToChat(items: RealMessageItem[]): ChatMessage[] {
  return items.map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    createdAt: m.createdAt,
    blocks:
      m.blocks?.length
        ? (m.blocks as ChatMessage["blocks"])
        : [{ type: "text" as const, markdown: m.content }],
    attachments: [],
  }));
}
