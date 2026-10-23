"use client";

import { StudioSidebar } from "./studio-sidebar";
import { StudioHeader } from "./studio-header";
import { DemoModeBanner } from "./demo-mode-banner";
import { DemoThread } from "@/components/chat/demo-thread";
import { ContextPanel } from "./context-panel";

export function StudioShell() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="hidden min-h-0 shrink-0 md:flex">
        <StudioSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <StudioHeader />
        <DemoModeBanner />
        <main className="flex min-h-0 flex-1 flex-col">
          <DemoThread />
        </main>
      </div>
      <ContextPanel />
    </div>
  );
}
