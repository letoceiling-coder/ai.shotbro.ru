"use client";

import { Badge } from "@/components/ui/badge";
import { useActiveBrief } from "@/hooks/use-creative-documents";

export function BriefSection({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useActiveBrief(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Загрузка brief…</div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h2 className="text-lg font-semibold">Creative Brief</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Brief появится после первого запроса агенту в AI Chat (документ BRIEF в PostgreSQL).
        </p>
      </div>
    );
  }

  const payload = data.payload as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6" data-testid="brief-section">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Creative Brief</h2>
        <Badge variant="secondary">v{data.version}</Badge>
      </div>
      <dl className="grid gap-3 text-sm">
        <Row label="Цель" value={String(payload.goal ?? "—")} />
        <Row label="Формат" value={String(payload.format ?? "—")} />
        <Row label="Длительность" value={`${payload.durationSeconds ?? "—"}s`} />
        <Row label="Aspect" value={String(payload.aspectRatio ?? "—")} />
        <Row label="Стиль" value={String(payload.style ?? "—")} />
        <Row label="Аудитория" value={String(payload.targetAudience ?? "—")} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}
