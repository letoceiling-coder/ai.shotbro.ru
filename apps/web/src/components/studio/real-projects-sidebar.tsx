"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateRealProject, useRealProjects } from "@/hooks/use-real-studio";
import { useStudioStore } from "@/store/studio-store";

export function RealProjectsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isLoading } = useRealProjects();
  const create = useCreateRealProject();
  const activeRealProjectId = useStudioStore((s) => s.activeRealProjectId);
  const setActiveRealProject = useStudioStore((s) => s.setActiveRealProject);

  useEffect(() => {
    if (!activeRealProjectId && data?.items?.[0]) {
      setActiveRealProject(data.items[0].id);
    }
  }, [activeRealProjectId, data, setActiveRealProject]);

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
      <Button
        variant="secondary"
        size="sm"
        className="mb-2 justify-start gap-2"
        aria-label="Создать REAL-проект"
        disabled={create.isPending}
        onClick={() => {
          create.mutate(
            { title: "Новый REAL-проект" },
            {
              onSuccess: (p: { id: string }) => {
                setActiveRealProject(p.id);
                onNavigate?.();
              },
            },
          );
        }}
      >
        <Plus className="size-4" />
        Новый проект
      </Button>
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
