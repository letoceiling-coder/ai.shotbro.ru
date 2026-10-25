"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { useModelCatalog } from "@/hooks/use-studio-production";
import { useActiveScript } from "@/hooks/use-creative-documents";

type ParamDef = {
  key: string;
  type: string;
  label: string;
  description?: string;
  enumValues?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  uiGroup?: string;
};

export function ModelSettingsSection({ projectId }: { projectId: string }) {
  const { data: script } = useActiveScript(projectId);
  const scenes = script?.payload.scenes ?? [];
  const [sceneId, setSceneId] = useState<string | null>(null);
  const selectedSceneId = sceneId ?? scenes[0]?.id ?? null;
  const { data: catalog } = useModelCatalog();
  const [modelId, setModelId] = useState("mock/image");
  const [fallbackMode, setFallbackMode] = useState<"disabled" | "automatic_compatible" | "ask_before_switch">(
    "automatic_compatible",
  );
  const qc = useQueryClient();

  const { data: paramDef } = useQuery({
    queryKey: ["model-parameters", modelId],
    queryFn: () =>
      apiFetch(`/api/v1/providers/model-parameters/${encodeURIComponent(modelId)}`) as Promise<{
        found: boolean;
        definition?: { parameterSchema: ParamDef[]; presets: Array<{ id: string; label: string; parameters: Record<string, unknown> }> };
      }>,
  });

  const operation =
    modelId.includes("upscaler") || modelId.includes("magnific") ? "IMAGE_UPSCALE" : "IMAGE_GENERATION";

  const { data: routePlan } = useQuery({
    queryKey: ["route-plan", selectedSceneId, modelId, fallbackMode],
    enabled: Boolean(selectedSceneId),
    queryFn: () =>
      apiFetch("/api/v1/providers/route-plan", {
        method: "POST",
        body: JSON.stringify({
          sceneId: selectedSceneId,
          operation,
          fallbackMode,
          aspectRatio: "9:16",
        }),
      }) as Promise<{ plan: { status: string; primary?: { providerId: string; modelId: string }; selected?: { providerId: string; modelId: string }; fallbacks?: unknown[] }; mockRoutingOnly?: boolean }>,
  });

  const { data: persistedRoute, refetch: refetchRoute } = useQuery({
    queryKey: ["provider-route", projectId, selectedSceneId],
    enabled: Boolean(projectId && selectedSceneId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/provider-route`) as Promise<{
        logicalOperation: { id: string; latestStatus: string; routePlanVersion: number } | null;
        plan: { status?: string; fallbackReason?: string; selected?: { providerId: string; modelId: string } } | null;
        routeEvents: Array<{ type: string; payload?: Record<string, unknown>; timestamp?: string }>;
        providerJobs: Array<{ id: string; routeMetadata?: Record<string, unknown> }>;
      }>,
    refetchInterval: 8_000,
  });

  const planRoute = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/provider-route/plan`, {
        method: "POST",
        body: JSON.stringify({ operation, fallbackMode, aspectRatio: "9:16" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-route", projectId, selectedSceneId] });
    },
  });

  const simulateFailure = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/provider-route/simulate-primary-failure`, {
        method: "POST",
        body: JSON.stringify({ operation }),
      }),
    onSuccess: () => refetchRoute(),
  });

  const { data: sceneSettings } = useQuery({
    queryKey: ["scene-model-settings", projectId, selectedSceneId],
    enabled: Boolean(selectedSceneId),
    queryFn: () =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/model-settings`) as Promise<{
        version: number;
        parameters: Record<string, Record<string, unknown>>;
      }>,
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/v1/projects/${projectId}/scenes/${selectedSceneId}/model-settings`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scene-model-settings", projectId, selectedSceneId] }),
  });

  const fields = paramDef?.definition?.parameterSchema ?? [];
  const currentParams = sceneSettings?.parameters?.[modelId] ?? {};
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const merged = useMemo(() => ({ ...currentParams, ...draft }), [currentParams, draft]);

  const imageModels = (catalog?.models ?? []).filter((m) =>
    m.supportedOperations.some((o) => o.includes("IMAGE")),
  );

  if (!scenes.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Сначала создайте сценарий (AI Chat → Script), затем настройте модели по сценам.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4" data-testid="model-settings-section">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Providers &amp; Models</h2>
        <Badge variant="demo">MOCK ROUTING</Badge>
      </div>
      <div className="mb-4 space-y-3" data-testid="provider-route-plan">
        {routePlan?.plan ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <p data-testid="provider-route-primary">
              Primary: {routePlan.plan.primary?.providerId ?? "—"} / {routePlan.plan.primary?.modelId ?? "—"}
            </p>
            <p data-testid="provider-route-selected">
              Preview selected: {routePlan.plan.selected?.providerId ?? "—"} · {routePlan.plan.status}
            </p>
            <p className="text-muted-foreground">
              Live I/O blocked · {routePlan.mockRoutingOnly ? "simulation only" : ""}
            </p>
          </div>
        ) : null}
        {persistedRoute?.logicalOperation ? (
          <div className="rounded-lg border border-border p-3 text-xs" data-testid="provider-route-status">
            <p>
              Saved route v{persistedRoute.logicalOperation.routePlanVersion}:{" "}
              {persistedRoute.logicalOperation.latestStatus}
            </p>
            <p>
              Selected: {persistedRoute.plan?.selected?.providerId ?? "—"} ·{" "}
              {persistedRoute.plan?.fallbackReason ? `Reason: ${persistedRoute.plan.fallbackReason}` : "primary path"}
            </p>
            {(persistedRoute.logicalOperation.latestStatus === "RE_APPROVAL_REQUIRED" ||
              persistedRoute.logicalOperation.latestStatus === "NEEDS_RECONCILIATION") && (
              <p className="mt-1 text-amber-600" data-testid="provider-route-blocked">
                {persistedRoute.logicalOperation.latestStatus === "RE_APPROVAL_REQUIRED"
                  ? "Re-approval required before fallback spend"
                  : "Reconciliation required — no auto resubmit"}
              </p>
            )}
          </div>
        ) : null}
        {persistedRoute?.routeEvents?.length ? (
          <div className="rounded-lg border border-border p-3 text-xs" data-testid="provider-route-timeline">
            <p className="mb-2 font-medium">Route timeline</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {persistedRoute.routeEvents.slice(-12).map((ev, i) => (
                <li key={`${ev.type}-${i}`} className="text-muted-foreground">
                  {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ""} · {ev.type}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!selectedSceneId || planRoute.isPending}
          data-testid="provider-route-save-plan"
          onClick={() => planRoute.mutate()}
        >
          Persist route plan
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedSceneId || simulateFailure.isPending}
          data-testid="provider-route-simulate-failure"
          onClick={() => simulateFailure.mutate()}
        >
          Simulate primary failure (mock)
        </Button>
      </div>
      <div className="mb-4">
        <Label>Fallback mode</Label>
        <Select value={fallbackMode} onValueChange={(v) => setFallbackMode(v as typeof fallbackMode)}>
          <SelectTrigger className="mt-1 max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="automatic_compatible">Automatic (compatible only)</SelectItem>
            <SelectItem value="ask_before_switch">Ask before switching</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Сцена</Label>
          <Select value={selectedSceneId ?? undefined} onValueChange={setSceneId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Сцена" />
            </SelectTrigger>
            <SelectContent>
              {scenes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.sequence}. {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Image model</Label>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {imageModels.map((m) => (
                <SelectItem key={m.modelId} value={m.modelId}>
                  {m.displayName} · {m.executionStatus}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key} className="rounded-lg border border-border p-3">
            <Label>{field.label}</Label>
            {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
            {field.type === "enum" ? (
              <Select
                value={String(merged[field.key] ?? field.default ?? "")}
                onValueChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(field.enumValues ?? []).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="mt-2"
                type={field.type === "integer" || field.type === "number" ? "number" : "text"}
                value={String(merged[field.key] ?? field.default ?? "")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [field.key]:
                      field.type === "integer" || field.type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  }))
                }
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(paramDef?.definition?.presets ?? []).map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant="outline"
            onClick={() => setDraft((d) => ({ ...d, ...p.parameters }))}
          >
            {p.label}
          </Button>
        ))}
        <Button
          disabled={!selectedSceneId || save.isPending}
          onClick={() =>
            save.mutate({
              expectedVersion: sceneSettings?.version,
              parameters: { [modelId]: merged },
              imageModelId: modelId,
              fallbackMode,
              primaryProviderId: "fal-flux",
              primaryModelId: modelId,
              fallbackProviderId: "openrouter",
              fallbackModelId: "openrouter/image/auto",
            })
          }
        >
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
