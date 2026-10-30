"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useActiveStoryboard,
  useAssignCharacterScene,
  useCharacters,
  useRestoreCharacter,
  useUpsertCharacter,
} from "@/hooks/use-creative-studio";
import { useActiveScript } from "@/hooks/use-creative-documents";
import { AssetPickerDialog } from "./asset-picker-dialog";
import { WorkspaceState } from "./workspace-state";
import { CharacterTalentPanel } from "./talent/character-talent-panel";
import type { CharacterProfile } from "@shotbro/contracts";

export function CharacterStudio({ projectId }: { projectId: string }) {
  const { data, isLoading } = useCharacters(projectId);
  const upsert = useUpsertCharacter(projectId);
  const assign = useAssignCharacterScene(projectId);
  const restore = useRestoreCharacter(projectId);
  const { data: script } = useActiveScript(projectId);
  const { data: storyboard } = useActiveStoryboard(projectId);
  const items = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CharacterProfile> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assignSceneId, setAssignSceneId] = useState<string>("");

  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? items[0], [items, selectedId]);
  const scriptScenes = script?.payload.scenes ?? [];
  const storyboardScenes = storyboard?.payload.scenes ?? [];
  const sceneOptions =
    scriptScenes.length > 0
      ? scriptScenes.map((s) => ({ id: s.id, title: s.title }))
      : storyboardScenes.map((s) => ({ id: s.sceneId, title: s.title }));

  useEffect(() => {
    if (selected && selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (selected) setDraft({ ...selected });
    else setDraft({ name: "", description: "", appearance: "", wardrobe: "", voiceNotes: "" });
  }, [selected?.id, selected?.version]);

  useEffect(() => {
    if (!assignSceneId && sceneOptions[0]) setAssignSceneId(sceneOptions[0].id);
  }, [sceneOptions, assignSceneId]);

  if (isLoading) return <WorkspaceState title="Characters" state="loading" />;

  async function save() {
    if (!draft?.name?.trim()) return;
    const res = (await upsert.mutateAsync({
      id: selected?.id,
      name: draft.name.trim(),
      description: draft.description,
      appearance: draft.appearance,
      wardrobe: draft.wardrobe,
      visualStyle: draft.visualStyle,
      voiceNotes: draft.voiceNotes,
      referenceAssetIds: draft.referenceAssetIds,
      primaryReferenceAssetId: draft.primaryReferenceAssetId,
      sceneIds: draft.sceneIds,
      expectedVersion: selected?.version,
    })) as CharacterProfile;
    setSelectedId(res.id);
  }

  async function onPickPrimary(assetId: string) {
    const refs = [...new Set([...(draft?.referenceAssetIds ?? []), assetId])];
    setDraft((d) => ({ ...d, referenceAssetIds: refs, primaryReferenceAssetId: assetId }));
    if (selected?.id) {
      await upsert.mutateAsync({
        id: selected.id,
        name: selected.name,
        referenceAssetIds: refs,
        primaryReferenceAssetId: assetId,
        expectedVersion: selected.version,
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row" data-testid="character-studio">
      <aside className="w-full border-b border-border md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-3">
          <h2 className="text-sm font-semibold">Персонажи</h2>
          <Button
            type="button"
            size="sm"
            data-testid="character-create"
            onClick={() => {
              setSelectedId(null);
              setDraft({ name: "Новый персонаж", description: "" });
            }}
          >
            +
          </Button>
        </div>
        <ScrollArea className="h-48 md:h-[calc(100%-3rem)]">
          <div className="space-y-1 p-2" data-testid="character-gallery">
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                data-testid={`character-row-${c.id}`}
                className={`w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${selected?.id === c.id ? "bg-muted font-medium" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                {c.name}
                <span className="ml-1 text-xs text-muted-foreground">v{c.version}</span>
              </button>
            ))}
            {items.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">Создайте первого персонажа</p>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4" data-testid="character-editor">
          {!draft ? null : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  data-testid="character-name"
                />
                {selected ? <Badge variant="outline">версия {selected.version}</Badge> : <Badge variant="secondary">новый</Badge>}
                <Button type="button" size="sm" onClick={() => void save()} disabled={upsert.isPending} data-testid="character-save">
                  Сохранить
                </Button>
              </div>
              <Field label="Описание" value={draft.description ?? ""} onChange={(v) => setDraft({ ...draft, description: v })} />
              <Field label="Внешность" value={draft.appearance ?? ""} onChange={(v) => setDraft({ ...draft, appearance: v })} />
              <Field label="Одежда" value={draft.wardrobe ?? ""} onChange={(v) => setDraft({ ...draft, wardrobe: v })} />
              <Field label="Заметки о голосе" value={draft.voiceNotes ?? ""} onChange={(v) => setDraft({ ...draft, voiceNotes: v })} />
              <div>
                <Label>Главное фото</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-xs">{draft.primaryReferenceAssetId ?? "—"}</code>
                  <Button type="button" size="sm" variant="secondary" data-testid="character-upload-ref" onClick={() => setPickerOpen(true)}>
                    Фото
                  </Button>
                </div>
              </div>
              {selected ? <CharacterTalentPanel projectId={projectId} character={selected} /> : null}
              {selected ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label>Назначить на сцену</Label>
                  <div className="flex flex-wrap gap-2">
                    <Select value={assignSceneId} onValueChange={setAssignSceneId}>
                      <SelectTrigger className="max-w-xs" data-testid="character-assign-scene">
                        <SelectValue placeholder="Сцена" />
                      </SelectTrigger>
                      <SelectContent>
                        {sceneOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      data-testid="character-assign-submit"
                      disabled={!assignSceneId || assign.isPending}
                      onClick={() =>
                        assign.mutate({
                          characterId: selected.id,
                          sceneId: assignSceneId,
                          characterVersion: selected.version,
                        })
                      }
                    >
                      Назначить
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Сцены персонажа</Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(selected.sceneIds ?? []).map((sid) => (
                        <Badge key={sid} variant="secondary">
                          {sid.slice(0, 8)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {(selected.history?.length ?? 0) > 0 ? (
                    <div>
                      <Label className="text-xs">Версии</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selected.history!.map((h) => (
                          <Button
                            key={h.version}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => restore.mutate({ characterId: selected.id, version: h.version })}
                          >
                            v{h.version}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Когда персонаж назначен на сцену, в раскадровке запоминается его текущая версия — внешность не «поплывёт» при правках.
              </p>
            </>
          )}
        </div>
      </ScrollArea>

      <AssetPickerDialog
        projectId={projectId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Фото персонажа"
        onPick={(id) => void onPickPrimary(id)}
      />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
