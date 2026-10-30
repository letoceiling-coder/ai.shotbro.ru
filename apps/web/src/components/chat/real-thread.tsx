"use client";

import { useEffect, useMemo, useRef } from "react";
import { CHAT_GUTTER } from "@/lib/layout";
import {
  mapRealMessagesToChat,
  useRealMessages,
  useEnsureDefaultConversation,
  useRealProjectConversations,
  useSendRealMessage,
} from "@/hooks/use-real-studio";
import { useRealUpload } from "@/hooks/use-real-upload";
import { useSharedProjectEvents } from "@/hooks/use-project-events";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ChatMessage } from "./chat-message";
import { ChatWelcome } from "./chat-welcome";
import { RealComposer } from "./real-composer";
import { useAgentWorkspaceAutoNav } from "@/hooks/use-agent-workspace-sync";
export function RealThread({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: convs, isPending: convsPending } = useRealProjectConversations(projectId);
  const ensureConversation = useEnsureDefaultConversation(projectId);
  const conversationId = convs?.[0]?.id as string | undefined;

  const ensureConv = ensureConversation.mutate;
  const ensuringConv = ensureConversation.isPending;
  useEffect(() => {
    if (convsPending || ensuringConv) return;
    if (Array.isArray(convs) && convs.length === 0) ensureConv();
  }, [convs, convsPending, ensuringConv, ensureConv]);

  useEffect(() => {
    if (!conversationId) return;
    void qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    void qc.invalidateQueries({ queryKey: ["approvals", projectId] });
  }, [conversationId, projectId, qc]);
  const { data: msgPage, isPending: messagesPending, isFetching: messagesFetching } =
    useRealMessages(conversationId);
  const send = useSendRealMessage(conversationId, projectId);
  const upload = useRealUpload(projectId);
  const { connected: sseConnected } = useSharedProjectEvents(projectId);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: assets } = useQuery({
    queryKey: ["assets", projectId],
    queryFn: () => api.assets.list(projectId),
  });

  const messages = useMemo(
    () => mapRealMessagesToChat(msgPage?.items ?? []),
    [msgPage],
  );

  useAgentWorkspaceAutoNav(messages);

  const messagesLoading = Boolean(conversationId) && (messagesPending || messagesFetching);

  const assetHint =
    Array.isArray(assets) && assets.length > 0 ? `файлов: ${assets.length}` : undefined;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="real-thread"
      data-conversation-id={conversationId ?? ""}
    >
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
          <ChatWelcome
            disabled={convsPending || !conversationId || send.isPending}
            onSend={(text) => send.mutate(text)}
          />
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
