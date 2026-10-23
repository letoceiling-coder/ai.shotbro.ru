"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ArrowUp,
  Clapperboard,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import { useAutosizeTextarea } from "@/hooks/use-autosize-textarea";
import { useStudioStore } from "@/store/studio-store";
import type { QualityStrategy } from "@shotbro/contracts";

const strategyLabels: Record<QualityStrategy, string> = {
  economy: "Экономия",
  balance: "Баланс",
  quality: "Качество",
};

export function ChatComposer() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appendUserMessage = useStudioStore((s) => s.appendUserMessage);
  const qualityStrategy = useStudioStore((s) => s.qualityStrategy);
  const setQualityStrategy = useStudioStore((s) => s.setQualityStrategy);

  useAutosizeTextarea(textareaRef, text, 168);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    maxSize: 50 * 1024 * 1024,
    onDropRejected: () => toast.error("Файл не подходит по типу или размеру (DEMO)"),
  });

  async function handleSend() {
    if (!text.trim() && files.length === 0) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 400));
    appendUserMessage(text.trim() || "Отправлены вложения (DEMO)", files);
    setText("");
    setFiles([]);
    setSending(false);
    toast.message("DEMO", {
      description: "Сообщение добавлено локально. Ответ агента — в готовых сценариях.",
    });
  }

  return (
    <div
      className={cn(
        "pointer-events-auto sticky bottom-0 z-10 border-t border-border/80 bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md",
        CHAT_GUTTER,
      )}
    >
      <div className={CHAT_COLUMN}>
        <div
          {...getRootProps()}
          className={cn(
            "rounded-2xl border border-border/80 bg-[var(--sb-surface)]/95 p-2 shadow-sm transition-colors sm:p-2.5",
            isDragActive && "border-primary ring-2 ring-primary/15",
          )}
        >
          <input {...getInputProps()} />
          {files.length ? (
            <div className="mb-1.5 flex flex-wrap gap-1.5 px-1">
              {files.map((file) => (
                <Badge key={file.name + file.size} variant="secondary" className="max-w-[180px] truncate">
                  {file.name}
                </Badge>
              ))}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите идею или прикрепите референс..."
            className="block w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="mt-1 flex flex-wrap items-center gap-0.5 sm:gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={open} aria-label="Прикрепить">
              <Plus className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 hidden sm:inline-flex" onClick={open} aria-label="Изображение">
              <ImagePlus className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 hidden sm:inline-flex" aria-label="Видео">
              <Clapperboard className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 hidden sm:inline-flex" aria-label="Голос (скоро)">
              <Mic className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="hidden h-8 md:inline-flex" onClick={open}>
              <Paperclip className="size-4" />
              Файлы
            </Button>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <Select
                value={qualityStrategy}
                onValueChange={(v) => setQualityStrategy(v as QualityStrategy)}
              >
                <SelectTrigger className="h-8 w-[7.5rem] border-border/70 text-xs sm:w-[8.25rem] sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(strategyLabels) as QualityStrategy[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {strategyLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                className="size-8 shrink-0 rounded-full sm:size-9"
                disabled={sending || (!text.trim() && files.length === 0)}
                onClick={() => void handleSend()}
                aria-label="Отправить"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

