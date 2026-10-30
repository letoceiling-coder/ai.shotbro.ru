"use client";

import { useId, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealUpload } from "@/hooks/use-real-upload";
import { waitAssetReady } from "@/hooks/use-talent";

export type UploadedFile = { assetId: string; name: string };

/** Upload into the project's storage and wait until each file is processed (READY). */
export function TalentFileInput({
  projectId,
  accept,
  max,
  files,
  onChange,
  label,
  testId,
}: {
  projectId: string;
  accept: string;
  max: number;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  label: string;
  testId: string;
}) {
  const inputId = useId();
  const upload = useRealUpload(projectId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(list: FileList) {
    setError(null);
    let next = [...files];
    for (const file of [...list].slice(0, Math.max(0, max - files.length))) {
      try {
        setBusy(file.name);
        const assetId = await upload.mutateAsync(file);
        await waitAssetReady(assetId);
        next = [...next, { assetId, name: file.name }];
        onChange(next);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "ошибка загрузки"}`);
      }
    }
    setBusy(null);
  }

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={max > 1}
          className="sr-only"
          data-testid={`${testId}-input`}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) void add(list);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy) || files.length >= max} asChild>
          <label htmlFor={inputId} className="cursor-pointer">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Paperclip className="mr-1 h-4 w-4" />}
            {busy ? `Обработка: ${busy}` : label}
          </label>
        </Button>
        <span className="text-xs text-muted-foreground">
          {files.length}/{max}
        </span>
      </div>
      {files.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f) => (
            <li
              key={f.assetId}
              className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
              data-testid={`${testId}-file`}
            >
              <span className="max-w-[180px] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={`Убрать ${f.name}`}
                onClick={() => onChange(files.filter((x) => x.assetId !== f.assetId))}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
