"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttachConsent } from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";
import { Input } from "@/components/ui/input";
import { TalentFileInput, type UploadedFile } from "./talent-file-input";
import { VoiceRecorder, consentScript } from "./voice-recorder";

/**
 * Consent of the real person whose voice or face is used (required by ElevenLabs IVC and HeyGen photo
 * avatars). The server stores the file, the confirmation time and the text version.
 */
export function ConsentBlock({
  projectId,
  kind,
  talentId,
  testId,
}: {
  projectId: string;
  kind: "voice" | "avatar";
  talentId: string;
  testId: string;
}) {
  const attach = useAttachConsent();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [checked, setChecked] = useState(false);
  const [personName, setPersonName] = useState("");
  const [how, setHow] = useState<"record" | "file">(kind === "voice" ? "record" : "file");
  const [error, setError] = useState<string | null>(null);
  const what = kind === "voice" ? "голоса" : "внешности";

  async function save() {
    const file = files[0];
    if (!file || !checked) return;
    setError(null);
    try {
      await attach.mutateAsync({ kind, id: talentId, consentAssetId: file.assetId });
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3" data-testid={testId}>
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <ShieldCheck className="h-4 w-4 text-amber-600" />
        Нужно согласие человека на использование его {what}
      </p>
      <div className="flex rounded-md border border-border p-0.5 text-xs">
        {(
          [
            ["record", "Записать голосом"],
            ["file", "Загрузить файл"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setHow(id)}
            data-testid={`${testId}-how-${id}`}
            className={`flex-1 rounded px-2 py-1 ${how === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {how === "record" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Человек, чей {kind === "voice" ? "голос" : "образ"} используется, сам читает короткий текст согласия.
          </p>
          <Input
            placeholder="Имя и фамилия человека"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            data-testid={`${testId}-person`}
          />
          {files.length ? (
            <p className="text-xs text-emerald-600" data-testid={`${testId}-recorded`}>
              Согласие записано ✓
            </p>
          ) : (
            <VoiceRecorder
              projectId={projectId}
              script={consentScript(personName, what)}
              minSeconds={5}
              maxSeconds={60}
              fileLabel="consent"
              disabled={!personName.trim()}
              onSaved={(f) => setFiles([f])}
              testId={`${testId}-recorder`}
            />
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Загрузите подписанное согласие (PDF, фото или запись, где человек даёт разрешение).
          </p>
          <TalentFileInput
            projectId={projectId}
            accept="application/pdf,image/*,audio/*,video/*"
            max={1}
            files={files}
            onChange={setFiles}
            label="Файл согласия"
            testId={`${testId}-file`}
          />
        </>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          data-testid={`${testId}-checkbox`}
        />
        <span>
          Я подтверждаю, что у меня есть разрешение этого человека на создание и использование копии его {what} в
          рекламных роликах.
        </span>
      </label>
      <Button
        type="button"
        size="sm"
        disabled={!files.length || !checked || attach.isPending}
        onClick={() => void save()}
        data-testid={`${testId}-save`}
      >
        Сохранить согласие
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
