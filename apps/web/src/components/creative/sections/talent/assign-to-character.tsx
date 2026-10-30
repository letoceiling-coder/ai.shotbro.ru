"use client";

import { useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCharacters } from "@/hooks/use-creative-studio";
import { useAssignTalent } from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";

/** "Назначить персонажу" — links workspace talent to a character of the open project. */
export function AssignToCharacter({
  projectId,
  kind,
  talentId,
  lookId,
  testId,
}: {
  projectId: string;
  kind: "voice" | "avatar";
  talentId: string;
  lookId?: string | null;
  testId: string;
}) {
  const { data } = useCharacters(projectId);
  const assign = useAssignTalent(projectId);
  const [characterId, setCharacterId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const characters = data?.items ?? [];
  const field = kind === "voice" ? "voiceProfileId" : "avatarProfileId";
  const linked = characters.filter((c) => c[field] === talentId);

  if (!characters.length) {
    return <span className="text-xs text-muted-foreground">В проекте нет персонажей — создайте их в разделе «Персонажи».</span>;
  }

  async function run() {
    if (!characterId) return;
    setMsg(null);
    try {
      await assign.mutateAsync(
        kind === "voice"
          ? { characterId, voiceProfileId: talentId }
          : { characterId, avatarProfileId: talentId, avatarLookId: lookId ?? null },
      );
      const name = characters.find((c) => c.id === characterId)?.name ?? "";
      setMsg({ ok: true, text: `Назначен персонажу «${name}»` });
    } catch (e) {
      setMsg({ ok: false, text: talentErrorMessage(e) });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      <select
        className="h-8 max-w-[160px] rounded-md border border-input bg-background px-2 text-xs"
        value={characterId}
        onChange={(e) => setCharacterId(e.target.value)}
        data-testid={`${testId}-select`}
        aria-label="Персонаж"
      >
        <option value="">Персонаж…</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!characterId || assign.isPending}
        onClick={() => void run()}
        data-testid={`${testId}-submit`}
      >
        <UserRoundCheck className="mr-1 h-4 w-4" />
        Назначить
      </Button>
      {linked.length ? (
        <span className="text-[11px] text-muted-foreground">У: {linked.map((c) => c.name).join(", ")}</span>
      ) : null}
      {msg ? <span className={msg.ok ? "text-[11px] text-emerald-600" : "text-[11px] text-destructive"}>{msg.text}</span> : null}
    </div>
  );
}
