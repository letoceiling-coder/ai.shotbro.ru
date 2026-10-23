"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import {
  mapRealMessagesToChat,
  useRealMessages,
  useRealProjectConversations,
  useSendRealMessage,
} from "@/hooks/use-real-studio";
import { ChatMessage } from "./chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export function RealThread({ projectId }: { projectId: string }) {
  const { data: convs } = useRealProjectConversations(projectId);
  const conversationId = convs?.[0]?.id as string | undefined;
  const { data: msgPage, isLoading } = useRealMessages(conversationId);
  const send = useSendRealMessage(conversationId);
  const [text, setText] = useState("");

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
        <div className={`${CHAT_COLUMN} flex gap-2`}>
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
