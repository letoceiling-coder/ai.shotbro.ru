"use client";

import { useState } from "react";
import type { CharacterProfile } from "@shotbro/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAssignTalent, useAvatars, useVoices } from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";
import { useStudioStore } from "@/store/studio-store";

/** Character ↔ reusable talent: which voice speaks for the character and which avatar plays it. */
export function CharacterTalentPanel({ projectId, character }: { projectId: string; character: CharacterProfile }) {
  const { data: voices } = useVoices();
  const { data: avatars } = useAvatars();
  const assign = useAssignTalent(projectId);
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const [error, setError] = useState<string | null>(null);

  const readyVoices = (voices?.items ?? []).filter((v) => v.status === "READY");
  const readyAvatars = (avatars?.items ?? []).filter((a) => a.status === "READY");
  const avatar = readyAvatars.find((a) => a.id === character.avatarProfileId);

  async function save(patch: { voiceProfileId?: string | null; avatarProfileId?: string | null; avatarLookId?: string | null }) {
    setError(null);
    try {
      await assign.mutateAsync({ characterId: character.id, ...patch });
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="character-talent">
      <div className="flex items-center justify-between">
        <Label>Голос и аватар</Label>
        <span className="text-[11px] text-muted-foreground">Общие для всех проектов</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Голос</span>
          <select
            className={selectCls}
            value={character.voiceProfileId ?? ""}
            disabled={assign.isPending}
            onChange={(e) => void save({ voiceProfileId: e.target.value || null })}
            data-testid="character-talent-voice"
          >
            <option value="">Не выбран</option>
            {readyVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary underline-offset-4 hover:bg-transparent hover:underline" onClick={() => setSection("voices")}>
            Все голоса →
          </Button>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Аватар</span>
          <select
            className={selectCls}
            value={character.avatarProfileId ?? ""}
            disabled={assign.isPending}
            onChange={(e) => {
              const next = readyAvatars.find((a) => a.id === e.target.value);
              const look = next?.looks.find((l) => l.isDefault) ?? next?.looks[0];
              void save({ avatarProfileId: next?.id ?? null, avatarLookId: look?.id ?? null });
            }}
            data-testid="character-talent-avatar"
          >
            <option value="">Не выбран</option>
            {readyAvatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {avatar && avatar.looks.length > 1 ? (
            <select
              className={selectCls}
              value={character.avatarLookId ?? ""}
              disabled={assign.isPending}
              onChange={(e) => void save({ avatarProfileId: avatar.id, avatarLookId: e.target.value || null })}
              data-testid="character-talent-look"
              aria-label="Образ"
            >
              {avatar.looks.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary underline-offset-4 hover:bg-transparent hover:underline" onClick={() => setSection("avatars")}>
            Все аватары →
          </Button>
        </div>
      </div>
      {!readyVoices.length && !readyAvatars.length ? (
        <p className="text-xs text-muted-foreground">Готовых голосов и аватаров пока нет — создайте их в разделах «Голоса» и «Аватары».</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
