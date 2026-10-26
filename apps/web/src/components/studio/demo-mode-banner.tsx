"use client";

import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function DemoModeBanner() {
  const { mode, setMode } = useStudioRuntimeMode();
  const session = authClient.useSession();
  const router = useRouter();
  if (mode !== "DEMO") return null;

  function openReal() {
    if (!session.data?.user) {
      router.push("/login?return=/studio&mode=real");
      return;
    }
    setMode("REAL");
  }

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-[var(--sb-warning)]/25 bg-[var(--sb-warning)]/8 px-3 py-1.5 text-center text-xs text-[var(--sb-text-muted)]"
      role="status"
    >
      <FlaskConical className="size-3.5 shrink-0 text-[var(--sb-warning)]" aria-hidden />
      <span>
        <span className="font-medium text-foreground">DEMO</span>
        {" · "}
        локальные сценарии и заглушки панелей. Панели «Файлы», «Раскадровка» и «Модели» здесь не отражают сервер.
      </span>
      <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={openReal}>
        Открыть REAL-студию
      </Button>
    </div>
  );
}
