"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useStudioRuntimeMode, type StudioRuntimeMode } from "@/components/auth/studio-mode-provider";

export function StudioModeSwitch({ className }: { className?: string }) {
  const { mode, setMode } = useStudioRuntimeMode();
  const session = authClient.useSession();
  const router = useRouter();

  function select(next: StudioRuntimeMode) {
    if (next === "REAL" && !session.data?.user) {
      router.push("/login?return=/studio&mode=real");
      return;
    }
    setMode(next);
  }

  return (
    <div
      className={cn("inline-flex rounded-lg border border-border bg-muted/40 p-0.5", className)}
      role="group"
      aria-label="Режим студии"
    >
      <Button
        type="button"
        size="sm"
        variant={mode === "DEMO" ? "default" : "ghost"}
        className="h-7 px-2.5 text-xs"
        onClick={() => select("DEMO")}
      >
        DEMO
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "REAL" ? "default" : "ghost"}
        className="h-7 px-2.5 text-xs"
        onClick={() => select("REAL")}
      >
        REAL
      </Button>
    </div>
  );
}
