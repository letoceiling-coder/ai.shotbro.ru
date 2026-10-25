"use client";

import { RealThread } from "@/components/chat/real-thread";
import { useStudioStore } from "@/store/studio-store";
import { CreativeSectionNav } from "./creative-section-nav";
import { ScriptEditor } from "./sections/script-editor";
import { BriefSection } from "./sections/brief-section";
import { PlaceholderSection } from "./sections/placeholder-section";
import { ModelSettingsSection } from "./sections/model-settings-section";
import { StoryboardStudio } from "./sections/storyboard-studio";
import { CharacterStudio } from "./sections/character-studio";
import { ReferenceManager } from "./sections/reference-manager";
import { PromptStudio } from "./sections/prompt-studio";
import { TimelineStudio } from "./sections/timeline-studio";

export function CreativeWorkspace({ projectId }: { projectId: string }) {
  const section = useStudioStore((s) => s.creativeSection);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="creative-workspace">
      <CreativeSectionNav />
      <div className="flex min-h-0 flex-1 flex-col">
        {section === "chat" ? <RealThread projectId={projectId} /> : null}
        {section === "brief" ? <BriefSection projectId={projectId} /> : null}
        {section === "script" ? <ScriptEditor projectId={projectId} /> : null}
        {section === "storyboard" ? <StoryboardStudio projectId={projectId} /> : null}
        {section === "characters" ? <CharacterStudio projectId={projectId} /> : null}
        {section === "references" ? <ReferenceManager projectId={projectId} /> : null}
        {section === "prompts" ? <PromptStudio projectId={projectId} /> : null}
        {section === "models" ? <ModelSettingsSection projectId={projectId} /> : null}
        {section === "production" ? (
          <PlaceholderSection title="Production" phase="5H" hint="Граф, jobs и approvals — см. правую панель и чат." />
        ) : null}
        {section === "timeline" ? <TimelineStudio projectId={projectId} /> : null}
        {section === "assets" ? (
          <PlaceholderSection title="Asset Library" phase="5J" hint="Расширенная медиатека проекта." />
        ) : null}
      </div>
    </div>
  );
}
