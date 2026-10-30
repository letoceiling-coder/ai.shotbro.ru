"use client";

import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  useAgentRuns,
  useModelCatalog,
  useProductionGraph,
  useProjectDetail,
  useProviderJobs,
  readProjectModelSettings,
} from "@/hooks/use-studio-production";
import { ModelSelector } from "./model-selector";
import type { QualityStrategy } from "@shotbro/contracts";
import { usePatchProjectSettings } from "@/hooks/use-studio-production";

type Tab = "context" | "production" | "assets" | "models";

export function RealContextPanel({
  projectId,
  mobileOpen,
  onMobileOpenChange,
}: {
  projectId: string;
  mobileOpen?: boolean;
  onMobileOpenChange?: (o: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>("context");
  const { data: project } = useProjectDetail(projectId);
  const settings = readProjectModelSettings(project?.settings);
  const patchSettings = usePatchProjectSettings(projectId);
  const { data: assets } = useQuery({
    queryKey: ["assets", projectId],
    queryFn: () => api.assets.list(projectId),
  });
  const { data: runs } = useAgentRuns(projectId);
  const latestRunId = (runs?.items?.[0] as { id?: string } | undefined)?.id;
  const { data: graph } = useProductionGraph(projectId, latestRunId);
  const { data: jobs } = useProviderJobs(projectId);
  const { data: catalog } = useModelCatalog();

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-border p-2">
        {(
          [
            ["context", "Контекст"],
            ["production", "Production"],
            ["assets", "Assets"],
            ["models", "Модели"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "default" : "ghost"}
            className="h-7 flex-1 text-xs"
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <ScrollArea className="flex-1 p-3">
        {tab === "context" ? (
          <div className="space-y-3 text-sm">
            <Badge variant="secondary">REAL · PostgreSQL</Badge>
            <p className="text-muted-foreground">
              Проект сохраняется на сервере. Платные действия (голос, аватар, видео) всегда запускаются только после вашего подтверждения цены.
            </p>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Бюджет</p>
              <p className="text-sm">Оценка и резерв — в карточках чата после расчёта агента.</p>
            </div>
          </div>
        ) : null}
        {tab === "production" ? (
          <ul className="space-y-2 text-xs">
            {(graph?.items ?? []).slice(0, 20).map((n: { id: string; nodeType: string; status: string }) => (
              <li key={n.id} className="flex justify-between rounded border border-border px-2 py-1">
                <span>{n.nodeType}</span>
                <Badge variant="outline">{n.status}</Badge>
              </li>
            ))}
            {!graph?.items?.length ? <p className="text-muted-foreground">Граф появится после запуска производства.</p> : null}
            <p className="pt-2 font-medium text-foreground">Provider jobs</p>
            {(jobs?.items ?? []).slice(0, 10).map((j: { id: string; status: string; providerId: string }) => (
              <li key={j.id} className="flex justify-between rounded border border-border px-2 py-1">
                <span>{j.providerId}</span>
                <Badge variant="outline">{j.status}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "assets" ? (
          <ul className="space-y-2">
            {(assets ?? []).map((a: { id: string; originalName?: string; mimeType?: string; category?: string }) => (
              <li key={a.id} className="rounded-lg border border-border p-2 text-xs">
                <div className="font-medium">{a.originalName ?? a.id}</div>
                <div className="text-muted-foreground">{a.mimeType}</div>
                {a.category?.includes("mock") ? <Badge variant="demo" className="mt-1">MOCK</Badge> : null}
              </li>
            ))}
            {!assets?.length ? <p className="text-sm text-muted-foreground">Пока нет файлов.</p> : null}
          </ul>
        ) : null}
        {tab === "models" ? (
          <div className="space-y-3">
            <ModelSelector
              strategy={settings.qualityStrategy === "manual" ? "manual" : settings.qualityStrategy}
              onStrategyChange={(s) => {
                const qualityStrategy = s === "manual" ? "balance" : s;
                patchSettings.mutate({
                  qualityStrategy: s === "manual" ? "manual" : qualityStrategy,
                });
              }}
              manualModelId={settings.manualModels?.llm}
              onManualModelChange={(modelId) =>
                patchSettings.mutate({ manualModels: { ...settings.manualModels, llm: modelId } })
              }
            />
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {(catalog?.models ?? []).slice(0, 8).map((m) => (
                <li key={m.modelId}>
                  {m.displayName} ·{" "}
                  {m.priceStatus === "UNKNOWN" ? "стоимость не подтверждена" : m.priceStatus}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-l border-border bg-[var(--sb-sidebar)] lg:flex",
          collapsed ? "w-12" : "w-[300px]",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-2 py-2">
          {!collapsed ? <span className="text-xs font-semibold uppercase tracking-wide">Студия</span> : null}
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
          </Button>
        </div>
        {!collapsed ? body : null}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>Контекст проекта</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    </>
  );
}
