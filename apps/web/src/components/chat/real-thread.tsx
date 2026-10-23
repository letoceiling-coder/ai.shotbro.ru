"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import {
  mapRealMessagesToChat,
  useRealMessages,
  useRealProjectConversations,
  useSendRealMessage,
} from "@/hooks/use-real-studio";
import { useRealUpload } from "@/hooks/use-real-upload";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ChatMessage } from "./chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export function RealThread({ projectId }: { projectId: string }) {
  const { data: convs } = useRealProjectConversations(projectId);
  const conversationId = convs?.[0]?.id as string | undefined;
  const { data: msgPage, isLoading } = useRealMessages(conversationId);
  const send = useSendRealMessage(conversationId);
  const upload = useRealUpload(projectId);
  const { data: assets } = useQuery({
    queryKey: ["assets", projectId],
    queryFn: () => api.assets.list(projectId),
  });
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(
    () => mapRealMessagesToChat(msgPage?.items ?? []),
    [msgPage],
  );

  useEffect(() => {
    if (!conversationId) return;
  }, [conversationId]);

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-32">
        {messages.length === 0 ? (
          <div className={`flex min-h-[40vh] flex-col items-center justify-center text-center ${CHAT_GUTTER}`}>
            <Sparkles className="mb-3 size-8 text-primary" />
            <h1 className={`${CHAT_COLUMN} text-xl font-semibold`}>REAL-проект</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Сообщения сохраняются на сервере. AI-ответы отключены до Фазы 3.
            </p>
          </div>
        ) : (
          <div className="pt-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} projectId={projectId} />
            ))}
          </div>
        )}
      </div>
      <div className={`sticky bottom-0 border-t border-border bg-background/95 backdrop-blur ${CHAT_GUTTER} py-3`}>
        {assets && assets.length > 0 ? (
          <p className={`${CHAT_COLUMN} mb-2 text-xs text-muted-foreground`}>
            Файлов в проекте: {assets.length}
          </p>
        ) : null}
        {upload.isError ? (
          <p className={`${CHAT_COLUMN} mb-2 text-xs text-destructive`}>
            Загрузка не удалась: {upload.error instanceof Error ? upload.error.message : "ошибка"}
          </p>
        ) : null}
        <div className={`${CHAT_COLUMN} flex gap-2`}>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? "…" : "Файл"}
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение сохранится на сервере…"
            rows={1}
            className="min-h-10 resize-none"
          />
          <Button
            disabled={!text.trim() || send.isPending || !conversationId}
            onClick={() => {
              send.mutate(text.trim(), { onSuccess: () => setText("") });
            }}
          >
            Отправить
          </Button>
        </div>
        <p className={`${CHAT_COLUMN} mt-2 text-xs text-muted-foreground`}>
          Нужен вход? <Link href="/login" className="text-primary underline">Войти</Link>
        </p>
      </div>
    </div>
  );
}
