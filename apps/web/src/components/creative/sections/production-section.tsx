"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAgentRuns,
  useAgentRunTrace,
  useProductionGraph,
  useProviderJobs,
} from "@/hooks/use-studio-production";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { ShotbroVideoPlayer } from "@/components/media/shotbro-video-player";
import { useAssetMediaUrl, resolveMediaSrc } from "@/hooks/use-asset-media-url";
import { Download } from "lucide-react";
import { WorkspaceState } from "./workspace-state";

type RunRow = {
  id: string;
  productionState?: string;
  status?: string;
  metadata?: { productionEnqueued?: boolean; mock?: boolean; deliveryAssetId?: string };
};

function DeliveryPlayer({ assetId }: { assetId: string }) {
  const { data: media, isError, isLoading } = useAssetMediaUrl(assetId);
  const src = resolveMediaSrc({ assetId }, media);
  if (isLoading) return <p className="text-xs text-muted-foreground">Загрузка MP4…</p>;
  if (isError || !src) {
    return <p className="text-xs text-destructive">Не удалось открыть mock MP4 (проверьте доступ).</p>;
  }
  return (
    <div className="space-y-2" data-testid="production-delivery-player">
      <ShotbroVideoPlayer src={src} aspectRatio="9:16" className="max-w-[280px]" />
      <Button size="sm" variant="secondary" asChild>
        <a href={src} download data-testid="production-delivery-download">
          <Download className="size-4" />
          Скачать MP4
        </a>
      </Button>
    </div>
  );
}

export function ProductionSection({ projectId }: { projectId: string }) {
  const { data: runs, isLoading: runsLoading } = useAgentRuns(projectId);
  const items = (runs?.items ?? []) as RunRow[];
  const latest = items[0];
  const runId = latest?.id;
  const { data: graph } = useProductionGraph(projectId, runId);
  const { data: jobs } = useProviderJobs(projectId);
  const { data: trace } = useAgentRunTrace(projectId, runId);
  const { data: assets } = useQuery({
    queryKey: ["assets", projectId, "delivery"],
    queryFn: () => apiFetch(`/api/v1/projects/${projectId}/assets`) as Promise<
      Array<{ id: string; mimeType?: string; originalName?: string; category?: string }>
    >,
    refetchInterval: 8_000,
  });

  const deliveryAssetId =
    latest?.metadata?.deliveryAssetId ??
    (assets ?? []).find(
      (a) => a.mimeType === "video/mp4" && String(a.originalName ?? "").includes("mock-delivery"),
    )?.id;

  if (runsLoading) return <WorkspaceState title="Production" state="loading" />;

  if (!latest) {
    return (
      <WorkspaceState
        title="Production"
        state="empty"
        message="Запустите агента в чате и пройдите согласования — здесь появится run, граф и jobs."
      />
    );
  }

  const graphNodes = (graph as { items?: Array<{ id: string; nodeType: string; status: string }> })?.items ?? [];
  const jobItems =
    (jobs as { items?: Array<{ id: string; status: string; providerId: string; operation?: string }> })?.items ?? [];
  const tools =
    (trace as { toolExecutions?: Array<{ toolName: string; status: string }> })?.toolExecutions ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="production-section">
      <header className="border-b border-border p-3">
        <h2 className="text-sm font-semibold">Production</h2>
        <p className="text-xs text-muted-foreground">
          Run {runId?.slice(0, 8)} · {latest.productionState ?? latest.status ?? "—"} · mock-only
        </p>
      </header>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4 text-sm">
          <section>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Run</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{latest.status ?? "—"}</Badge>
              <Badge variant="secondary">{latest.productionState ?? "DRAFT"}</Badge>
              {latest.metadata?.productionEnqueued ? <Badge>Enqueued</Badge> : null}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Graph nodes</p>
            {graphNodes.length === 0 ? (
              <p className="text-muted-foreground">Граф появится после запуска производства.</p>
            ) : (
              <ul className="space-y-1">
                {graphNodes.map((n) => (
                  <li key={n.id} className="flex justify-between rounded border border-border px-2 py-1 text-xs">
                    <span>{n.nodeType}</span>
                    <Badge variant="outline">{n.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Provider jobs</p>
            {jobItems.length === 0 ? (
              <p className="text-muted-foreground">Нет активных jobs.</p>
            ) : (
              <ul className="space-y-1">
                {jobItems.map((j) => (
                  <li key={j.id} className="flex justify-between rounded border border-border px-2 py-1 text-xs">
                    <span>
                      {j.providerId} · {j.operation ?? "—"}
                    </span>
                    <Badge variant="outline">{j.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {tools.length ? (
            <section>
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Tool executions</p>
              <ul className="space-y-1 text-xs">
                {tools.map((t, i) => (
                  <li key={`${t.toolName}-${i}`} className="flex justify-between rounded border border-border px-2 py-1">
                    <span>{t.toolName}</span>
                    <Badge variant="outline">{t.status}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Delivery</p>
            {deliveryAssetId ? (
              <DeliveryPlayer assetId={deliveryAssetId} />
            ) : (
              <p className="text-muted-foreground">Mock MP4 появится после assembly.</p>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
