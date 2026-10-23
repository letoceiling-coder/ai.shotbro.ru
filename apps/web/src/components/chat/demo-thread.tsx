"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useActiveProject } from "@/store/studio-store";
import { CHAT_COLUMN, CHAT_GUTTER } from "@/lib/layout";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";
import { RealThread } from "./real-thread";
import { useStudioStore } from "@/store/studio-store";

export function DemoThread() {
  const { mode } = useStudioRuntimeMode();
  const activeRealProjectId = useStudioStore((s) => s.activeRealProjectId);
  const project = useActiveProject();

  if (mode === "REAL" && activeRealProjectId) {
    return <RealThread projectId={activeRealProjectId} />;
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Выберите проект
      </div>
    );
  }

  const isEmpty = project.messages.length === 0;

  return (
    <ThreadPrimitive.Root className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {isEmpty ? (
          <EmptyHero />
        ) : (
          <div className="pt-4 sm:pt-5">
            {project.messages.map((msg) => (
              <div key={msg.id} className="group">
                <ChatMessage message={msg} projectId={project.id} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      <ChatComposer />
    </ThreadPrimitive.Root>
  );
}

function EmptyHero() {
  return (
    <div
      className={`flex min-h-[min(56vh,520px)] flex-col items-center justify-center text-center ${CHAT_GUTTER}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="mb-5 flex size-14 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/25 sm:size-16"
      >
        <Sparkles className="size-6 text-primary sm:size-7" />
      </motion.div>
      <h1 className={`${CHAT_COLUMN} text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl`}>
        Что создадим сегодня?
      </h1>
      <p className={`${CHAT_COLUMN} mt-2 text-sm text-muted-foreground sm:text-base`}>
        Видео, изображения, персонажи и реклама — всё в одном диалоге
      </p>
    </div>
  );
}
