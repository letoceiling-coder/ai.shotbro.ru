"use client";

import { RealThread } from "@/components/chat/real-thread";
import { useStudioStore } from "@/store/studio-store";
import { CreativeSectionNav } from "./creative-section-nav";
import { ScriptEditor } from "./sections/script-editor";
import { BriefSection } from "./sections/brief-section";
import { PlaceholderSection } from "./sections/placeholder-section";

export function CreativeWorkspace({ projectId }: { projectId: string }) {
  const section = useStudioStore((s) => s.creativeSection);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="creative-workspace">
      <CreativeSectionNav />
      <div className="flex min-h-0 flex-1 flex-col">
        {section === "chat" ? <RealThread projectId={projectId} /> : null}
        {section === "brief" ? <BriefSection projectId={projectId} /> : null}
        {section === "script" ? <ScriptEditor projectId={projectId} /> : null}
        {section === "storyboard" ? (
          <PlaceholderSection
            title="Storyboard Studio"
            phase="5D"
            hint="Сетка кадров, first/last frame assets и mock generation — следующий этап."
          />
        ) : null}
        {section === "characters" ? (
          <PlaceholderSection title="Character Studio" phase="5E" hint="Галерея персонажей через ProjectMemory API." />
        ) : null}
        {section === "references" ? (
          <PlaceholderSection title="Reference Manager" phase="5F" hint="Привязка assets к сценам и персонажам." />
        ) : null}
        {section === "production" ? (
          <PlaceholderSection title="Production" phase="5H" hint="Граф, jobs и approvals — см. правую панель и чат." />
        ) : null}
        {section === "timeline" ? (
          <PlaceholderSection title="Timeline" phase="5I" hint="Версионируемый монтажный JSON + FFmpeg assembly." />
        ) : null}
        {section === "assets" ? (
          <PlaceholderSection title="Asset Library" phase="5J" hint="Расширенная медиатека проекта." />
        ) : null}
      </div>
    </div>
  );
}
