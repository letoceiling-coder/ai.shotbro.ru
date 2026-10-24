"use client";

import { FlaskConical } from "lucide-react";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";

export function DemoModeBanner() {
  const { mode } = useStudioRuntimeMode();
  if (mode !== "DEMO") return null;

  return (
    <div
      className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--sb-warning)]/25 bg-[var(--sb-warning)]/8 px-3 py-1.5 text-center text-xs text-[var(--sb-text-muted)]"
      role="status"
    >
      <FlaskConical className="size-3.5 shrink-0 text-[var(--sb-warning)]" aria-hidden />
      <span>
        <span className="font-medium text-foreground">DEMO</span>
        {" · "}
        локальные сценарии без сервера. Переключите REAL в настройках для настоящих проектов.
      </span>
    </div>
  );
}
