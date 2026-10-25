"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveScript } from "@/hooks/use-creative-documents";
import {
  useAttachReference,
  useCharacters,
  useDetachReference,
  useReferences,
} from "@/hooks/use-creative-studio";
import { AssetPickerDialog } from "./asset-picker-dialog";
import { WorkspaceState } from "./workspace-state";

const ROLES = [
  "GENERAL",
  "CHARACTER",
  "STYLE",
  "FIRST_FRAME",
  "LAST_FRAME",
  "PRODUCT",
  "LOCATION",
  "CAMERA",
  "VOICE",
] as const;

export function ReferenceManager({ projectId }: { projectId: string }) {
  const { data, isLoading } = useReferences(projectId);
  const attach = useAttachReference(projectId);
  const detach = useDetachReference(projectId);
  const { data: script } = useActiveScript(projectId);
  const { data: characters } = useCharacters(projectId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [role, setRole] = useState<(typeof ROLES)[number]>("GENERAL");
  const [sceneId, setSceneId] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");

  const items = data?.items ?? [];
  const scenes = script?.payload.scenes ?? [];

  if (isLoading) return <WorkspaceState title="References" state="loading" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="reference-manager">
      <header className="flex flex-wrap items-end gap-3 border-b border-border p-3">
        <div>
          <h2 className="text-sm font-semibold">Reference Manager</h2>
          <p className="text-xs text-muted-foreground">{items.length} связей · файлы в MinIO через AssetService</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as (typeof ROLES)[number])}>
              <SelectTrigger className="w-36" data-testid="reference-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Scene</Label>
            <Select value={sceneId || "__none"} onValueChange={(v) => setSceneId(v === "__none" ? "" : v)}>
              <SelectTrigger className="w-40" data-testid="reference-scene">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {scenes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Character</Label>
            <Select value={characterId || "__none"} onValueChange={(v) => setCharacterId(v === "__none" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {(characters?.items ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" data-testid="reference-attach-open" onClick={() => setPickerOpen(true)}>
            Прикрепить
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border" data-testid="reference-list">
          {items.map((link) => (
            <div key={link.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <Badge variant="outline">{link.role}</Badge>
              <code className="text-xs">{link.assetId.slice(0, 12)}…</code>
              {link.sceneId ? <Badge variant="secondary">scene {link.sceneId.slice(0, 8)}</Badge> : null}
              {link.characterId ? <Badge variant="secondary">char {link.characterId.slice(0, 8)}</Badge> : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto"
                data-testid={`reference-detach-${link.id}`}
                onClick={() => detach.mutate(link.id)}
              >
                Отвязать
              </Button>
            </div>
          ))}
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Нет референсов — загрузите или выберите из библиотеки.</p>
          ) : null}
        </div>
      </ScrollArea>

      <AssetPickerDialog
        projectId={projectId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Reference picker"
        onPick={(assetId) => {
          attach.mutate({
            assetId,
            role,
            sceneId: sceneId || undefined,
            characterId: characterId || undefined,
          });
        }}
      />
    </div>
  );
}
