"use client";

import { useEffect, useState } from "react";
import { StudioSidebar } from "./studio-sidebar";
import { StudioHeader } from "./studio-header";
import { DemoModeBanner } from "./demo-mode-banner";
import { DemoThread } from "@/components/chat/demo-thread";
import { CreativeWorkspace } from "@/components/creative/creative-workspace";
import { RealStudioEmpty } from "./real-studio-empty";
import { ContextPanel } from "./context-panel";
import { RealContextPanel } from "./real-context-panel";
import { AgentRunStrip } from "./agent-run-strip";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";

export function StudioShell({ initialSection }: { initialSection?: CreativeSection } = {}) {
  const { mode } = useStudioRuntimeMode();
  const activeRealProjectId = useStudioStore((s) => s.activeRealProjectId);
  const setCreativeSection = useStudioStore((s) => s.setCreativeSection);
  const [mobileContext, setMobileContext] = useState(false);

  // Direct links (/studio/library/voices, /studio/library/avatars) open their section once.
  useEffect(() => {
    if (initialSection) setCreativeSection(initialSection);
  }, [initialSection, setCreativeSection]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="hidden min-h-0 shrink-0 md:flex">
        <StudioSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <StudioHeader onOpenContext={() => setMobileContext(true)} />
        {mode === "DEMO" ? <DemoModeBanner /> : null}
        {mode === "REAL" && activeRealProjectId ? <AgentRunStrip projectId={activeRealProjectId} /> : null}
        <main className="flex min-h-0 flex-1 flex-col">
          {mode === "REAL" ? (
            activeRealProjectId ? (
              <CreativeWorkspace projectId={activeRealProjectId} />
            ) : (
              <RealStudioEmpty />
            )
          ) : (
            <DemoThread />
          )}
        </main>
      </div>
      {mode === "REAL" && activeRealProjectId ? (
        <RealContextPanel
          projectId={activeRealProjectId}
          mobileOpen={mobileContext}
          onMobileOpenChange={setMobileContext}
        />
      ) : (
        <ContextPanel />
      )}
    </div>
  );
}
