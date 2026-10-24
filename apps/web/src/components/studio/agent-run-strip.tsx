"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAgentRunTrace, useAgentRuns } from "@/hooks/use-studio-production";
import { api } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const STEP_LABELS: Record<string, string> = {
  ANALYZING: "Анализирую задачу",
  PLANNING: "Формирую план",
  SCRIPTING: "Формирую сценарий",
  STORYBOARD: "Раскадровка",
  COSTING: "Рассчитываю стоимость",
  AWAITING_APPROVAL: "Ожидаю согласования",
  PRODUCTION: "Подготавливаю производство",
  ASSEMBLY: "Собираю ролик",
  DELIVERY: "Готовлю delivery",
  COMPLETED: "Готово",
  FAILED: "Ошибка",
};

export function AgentRunStrip({ projectId }: { projectId: string }) {
  const { data: runs } = useAgentRuns(projectId);
  const qc = useQueryClient();
  const latest = runs?.items?.[0] as
    | { id: string; status: string; productionState?: string }
    | undefined;
  const { data: trace } = useAgentRunTrace(projectId, latest?.id);

  const resume = useMutation({
    mutationFn: () => api.agent.resume(projectId, latest!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-runs", projectId] }),
  });

  if (!latest) return null;

  const state = String(latest.productionState ?? trace?.productionState ?? latest.status);
  const label = STEP_LABELS[state] ?? state;
  const running = ["RUNNING", "QUEUED", "PLANNING", "PRODUCTION"].includes(latest.status);
  const tools = (trace?.toolExecutions ?? []) as Array<{ toolName: string; status: string }>;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/20 px-4 py-2 text-sm"
      data-testid="agent-run-strip"
    >
      <Badge variant={running ? "default" : "secondary"}>{label}</Badge>
      <span className="text-xs text-muted-foreground">Run {latest.id.slice(0, 8)}</span>
      {running ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : null}
      {tools.slice(-3).map((t) => (
        <Badge key={t.toolName + t.status} variant="outline" className="text-[10px] font-normal">
          {t.toolName}: {t.status}
        </Badge>
      ))}
      {latest.status === "PAUSED" || state === "AWAITING_APPROVAL" ? (
        <Button size="sm" variant="outline" className="ml-auto h-7 gap-1" onClick={() => resume.mutate()}>
          <Play className="size-3" />
          Продолжить
        </Button>
      ) : null}
      {running ? (
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Pause className="size-3" />
          Mock AI · без live-вызовов
        </span>
      ) : null}
    </div>
  );
}
