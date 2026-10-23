"use client";

import { useState } from "react";
import type { Attachment } from "@shotbro/contracts";
import Image from "next/image";
import { FileText, Film, ImageIcon, Music, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const kindIcon = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
} as const;

function AttachmentThumb({ att, onPreview }: { att: Attachment; onPreview: () => void }) {
  const Icon = kindIcon[att.kind];
  const canPreview = att.kind === "image" && att.url && att.url !== "#";

  return (
    <button
      type="button"
      onClick={onPreview}
      className={cn(
        "group flex max-w-full items-center gap-2 rounded-lg border border-border/80 bg-[var(--sb-surface-hover)]/50 px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/30 hover:bg-[var(--sb-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        canPreview && "pr-2.5",
      )}
    >
      {canPreview ? (
        <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-black/30">
          <Image
            src={att.url}
            alt=""
            fill
            className="object-cover"
            sizes="40px"
            unoptimized
          />
        </span>
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
          <Icon className="size-4 text-muted-foreground" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{att.name}</span>
        <span className="block truncate text-[10px] text-muted-foreground capitalize">
          {att.kind}
        </span>
      </span>
      {canPreview ? (
        <ZoomIn className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </button>
  );
}

export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const [preview, setPreview] = useState<Attachment | null>(null);

  if (!attachments?.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <AttachmentThumb
            key={att.id}
            att={att}
            onPreview={() => {
              if (att.kind === "image" && att.url && att.url !== "#") setPreview(att);
            }}
          />
        ))}
      </div>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-sm">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.url ? (
            <div className="relative aspect-[4/5] max-h-[70vh] w-full bg-black/40">
              <Image
                src={preview.url}
                alt={preview.name}
                fill
                className="object-contain"
                sizes="(max-width:512px) 100vw, 512px"
                unoptimized
              />
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Превью недоступно</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
