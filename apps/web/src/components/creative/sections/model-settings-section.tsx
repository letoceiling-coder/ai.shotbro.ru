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
  const qc = useQueryClient();

  const { data: paramDef } = useQuery({
    queryKey: ["model-parameters", modelId],
    queryFn: () =>
      apiFetch(`/api/v1/providers/model-parameters/${encodeURIComponent(modelId)}`) as Promise<{
        found: boolean;
        definition?: { parameterSchema: ParamDef[]; presets: Array<{ id: string; label: string; parameters: Record<string, unknown> }> };
      }>,
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
        <h2 className="text-lg font-semibold">Model Settings</h2>
        <Badge variant="demo">MOCK POLICY</Badge>
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
            })
          }
        >
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
