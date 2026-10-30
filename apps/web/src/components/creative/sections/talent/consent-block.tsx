"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttachConsent } from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";
import { TalentFileInput, type UploadedFile } from "./talent-file-input";

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
      <p className="text-xs text-muted-foreground">
        Загрузите подписанное согласие (PDF, фото или запись, где человек даёт разрешение) и подтвердите галочкой.
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
