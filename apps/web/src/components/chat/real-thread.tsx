"use client";

import { useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import {
  mapRealMessagesToChat,
  useRealMessages,
  useRealProjectConversations,
  useSendRealMessage,
} from "@/hooks/use-real-studio";
import { useRealUpload } from "@/hooks/use-real-upload";
import { useProjectEvents } from "@/hooks/use-project-events";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ChatMessage } from "./chat-message";
import Link from "next/link";
import { RealComposer } from "./real-composer";
export function RealThread({ projectId }: { projectId: string }) {
  const { data: convs, isPending: convsPending } = useRealProjectConversations(projectId);
  const conversationId = convs?.[0]?.id as string | undefined;
  const { data: msgPage, isPending: messagesPending, isFetching: messagesFetching } =
    useRealMessages(conversationId);
  const send = useSendRealMessage(conversationId, projectId);
  const upload = useRealUpload(projectId);
  const { connected: sseConnected } = useProjectEvents(projectId);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: assets } = useQuery({
    queryKey: ["assets", projectId],
    queryFn: () => api.assets.list(projectId),
  });

  const messages = useMemo(
    () => mapRealMessagesToChat(msgPage?.items ?? []),
    [msgPage],
  );

  const messagesLoading = Boolean(conversationId) && (messagesPending || messagesFetching);

  const assetHint =
    Array.isArray(assets) && assets.length > 0 ? `файлов: ${assets.length}` : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-testid="real-thread">
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-36">
        {messagesLoading ? (
          <div className="flex min-h-[40vh] flex-1 items-center justify-center text-muted-foreground">Загрузка…</div>
        ) : messages.length === 0 ? (
          <div className={`flex min-h-[40vh] flex-col items-center justify-center text-center ${CHAT_GUTTER}`}>
            <Sparkles className="mb-3 size-8 text-primary" />
            <h1 className={`${CHAT_COLUMN} text-xl font-semibold`}>AI-видеостудия</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Опишите ролик — агент покажет шаги, сценарий, согласования и mock-производство. Live AI заблокирован
              политикой.
            </p>
            <p className={`${CHAT_COLUMN} mt-4 text-xs text-muted-foreground`}>
              Нужен вход?{" "}
              <Link href="/login" className="text-primary underline">
                Войти
              </Link>
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
      {upload.isError ? (
        <p className={`${CHAT_GUTTER} text-xs text-destructive`}>Загрузка не удалась</p>
      ) : null}
      <RealComposer
        projectId={projectId}
        disabled={convsPending || !conversationId || send.isPending}
        waitingForConversation={convsPending || !conversationId}
        sseConnected={sseConnected}
        assetHint={assetHint}
        uploadPending={upload.isPending}
        onPickFile={() => fileRef.current?.click()}
        onSend={(text) => send.mutate(text)}
      />
    </div>
  );
}
