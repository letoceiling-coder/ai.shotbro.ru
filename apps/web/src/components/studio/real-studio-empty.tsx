"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "./new-project-dialog";
import { useCreateRealProject, useRealProjects } from "@/hooks/use-real-studio";
import { useStudioStore } from "@/store/studio-store";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export function RealStudioEmpty() {
  const session = authClient.useSession();
  const create = useCreateRealProject();
  const qc = useQueryClient();
  const setActiveRealProject = useStudioStore((s) => s.setActiveRealProject);
  const { isLoading } = useRealProjects();

  if (!session.data?.user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <FolderOpen className="size-10 text-muted-foreground" aria-hidden />
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-semibold">REAL-студия</h2>
          <p className="text-sm text-muted-foreground">
            Серверные проекты, агент, Creative Workspace и mock-производство. Войдите, чтобы продолжить.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?return=/studio&mode=real">Войти</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <FolderOpen className="size-10 text-primary/80" aria-hidden />
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">Выберите или создайте проект</h2>
        <p className="text-sm text-muted-foreground">
          Слева — список REAL-проектов. Здесь откроется чат, Script, Storyboard, Timeline и остальные модули.
        </p>
      </div>
      <NewProjectDialog
        pending={create.isPending || isLoading}
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
                await qc.invalidateQueries({ queryKey: ["conversations", p.id] });
                if (seedPrompt) {
                  const convs = (await apiFetch(`/api/v1/projects/${p.id}/conversations`)) as Array<{ id: string }>;
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
    </div>
  );
}
