"use client";

import type { ChatMessage as ChatMessageType } from "@shotbro/contracts";
import { Copy, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import { MessageAttachments } from "./message-attachments";
import { MessageBlockRenderer } from "./blocks/message-block-renderer";

export function ChatMessage({
  message,
  projectId,
}: {
  message: ChatMessageType;
  projectId: string;
}) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        CHAT_COLUMN,
        CHAT_GUTTER,
        "py-3 sm:py-3.5",
        !isUser && "border-y border-border/30 bg-[var(--sb-surface)]/15",
      )}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            isUser ? "bg-secondary text-foreground" : "bg-primary/15 text-primary",
          )}
        >
          {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
        </div>
        <span className="text-xs font-medium text-foreground">
          {isUser ? "Пользователь" : "SHOTBRO Agent"}
        </span>
        {!isUser ? (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              const text = message.blocks
                .filter((b) => b.type === "text")
                .map((b) => (b.type === "text" ? b.markdown : ""))
                .join("\n");
              void navigator.clipboard.writeText(text);
              toast.success("Скопировано");
            }}
            aria-label="Копировать сообщение"
          >
            <Copy className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-3 pl-0 sm:pl-9">
        {isUser && message.attachments?.length ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
        {message.blocks.map((block, i) => (
          <MessageBlockRenderer key={`${message.id}-${i}`} block={block} projectId={projectId} />
        ))}
        {!isUser && message.attachments?.length ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
      </div>
    </article>
  );
}
