"use client";

import { useRef, useState } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import { ModelSelector } from "@/components/studio/model-selector";
import {
  readProjectModelSettings,
  usePatchProjectSettings,
  useProjectDetail,
} from "@/hooks/use-studio-production";
import type { QualityStrategy } from "@shotbro/contracts";

type Props = {
  projectId: string;
  disabled?: boolean;
  onSend: (text: string) => void;
  onPickFile: () => void;
  uploadPending?: boolean;
  sseConnected?: boolean;
  assetHint?: string;
};

export function RealComposer({
  projectId,
  disabled,
  onSend,
  onPickFile,
  uploadPending,
  sseConnected,
  assetHint,
}: Props) {
  const [text, setText] = useState("");
  const { data: project } = useProjectDetail(projectId);
  const settings = readProjectModelSettings(project?.settings);
  const patchSettings = usePatchProjectSettings(projectId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const strategy =
    settings.qualityStrategy === "manual" ? ("manual" as const) : (settings.qualityStrategy as QualityStrategy);

  return (
    <div
      className={`sticky bottom-0 border-t border-border bg-background/95 backdrop-blur ${CHAT_GUTTER} py-3`}
      data-testid="real-composer"
    >
      <p className={`${CHAT_COLUMN} mb-2 text-xs text-muted-foreground`}>
        События: {sseConnected ? "подключено" : "переподключение…"}
        {assetHint ? ` · ${assetHint}` : ""}
      </p>
      <div className={`${CHAT_COLUMN} mb-2`}>
        <ModelSelector
          strategy={strategy}
          onStrategyChange={(s) => {
            patchSettings.mutate({
              qualityStrategy: s,
              ...(s !== "manual" ? { manualModels: settings.manualModels } : {}),
            });
          }}
          manualModelId={settings.manualModels?.llm}
          onManualModelChange={(modelId) =>
            patchSettings.mutate({
              qualityStrategy: "manual",
              manualModels: { ...settings.manualModels, llm: modelId },
            })
          }
          disabled={disabled}
        />
      </div>
      <div className={`${CHAT_COLUMN} flex gap-2`}>
        <Button type="button" variant="outline" size="sm" disabled={uploadPending} onClick={onPickFile}>
          <Paperclip className="size-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Опишите задачу — агент подготовит brief, сценарий и mock-производство…"
          rows={1}
          className="min-h-10 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim() && !disabled) {
                onSend(text.trim());
                setText("");
              }
            }
          }}
        />
        <Button
          disabled={!text.trim() || disabled}
          aria-label="Отправить"
          onClick={() => {
            onSend(text.trim());
            setText("");
          }}
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
