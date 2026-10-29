"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCreateRealProject, useRealProjects } from "@/hooks/use-real-studio";
import { useQueryClient } from "@tanstack/react-query";
import { useStudioStore } from "@/store/studio-store";
import { NewProjectDialog } from "./new-project-dialog";
import { api, apiFetch } from "@/lib/api-client";

function readPersistedRealProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("shotbro-studio-demo-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { activeRealProjectId?: string | null } };
    const id = parsed.state?.activeRealProjectId;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function RealProjectsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useRealProjects();
  const create = useCreateRealProject();
  const activeRealProjectId = useStudioStore((s) => s.activeRealProjectId);
  const setActiveRealProject = useStudioStore((s) => s.setActiveRealProject);

  useEffect(() => {
    if (activeRealProjectId) return;
    const items = data?.items;
    if (!items?.length) return;
    const pinned = readPersistedRealProjectId();
    if (pinned && items.some((p: { id: string }) => p.id === pinned)) {
      setActiveRealProject(pinned);
      return;
    }
    setActiveRealProject(items[0].id);
  }, [activeRealProjectId, data, setActiveRealProject]);

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
      <NewProjectDialog
        pending={create.isPending}
        onCreate={({ title, templateId, seedPrompt }, dialog) => {
          create.mutate(
            {
              title,
              settings: {
                productionTemplateId: templateId,
                qualityStrategy: "balance",
              },
            },
            {
              onSuccess: async (p: { id: string }) => {
                setActiveRealProject(p.id);
                dialog.close();
                onNavigate?.();
                await qc.invalidateQueries({ queryKey: ["conversations", p.id] });
                void qc.prefetchQuery({
                  queryKey: ["conversations", p.id],
                  queryFn: () => apiFetch(`/api/v1/projects/${p.id}/conversations`),
                });
                if (seedPrompt) {
                  const convs = (await apiFetch(`/api/v1/projects/${p.id}/conversations`)) as Array<{
                    id: string;
                  }>;
                  const cid = convs[0]?.id;
                  if (cid) {
                    await apiFetch(`/api/v1/conversations/${cid}/messages`, {
                      method: "POST",
                      body: JSON.stringify({
                        content: seedPrompt,
                        role: "user",
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    });
                    try {
                      await api.agent.createRun(p.id, { userRequest: seedPrompt, conversationId: cid });
                    } catch {
                      /* may stop at approval */
                    }
                  }
                }
              },
            },
          );
        }}
      />
      {isLoading ? <p className="px-2 text-xs text-muted-foreground">Загрузка…</p> : null}
      {data?.items?.map((p: { id: string; title: string }) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            setActiveRealProject(p.id);
            onNavigate?.();
          }}
          className={cn(
            "rounded-lg px-3 py-2 text-left text-sm transition-colors",
            activeRealProjectId === p.id
              ? "bg-primary/15 font-medium text-foreground ring-1 ring-primary/30"
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
          )}
        >
          {p.title}
        </button>
      ))}
    </div>
  );
}
