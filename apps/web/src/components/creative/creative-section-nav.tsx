"use client";

import { cn } from "@/lib/utils";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const SECTIONS: { id: CreativeSection; label: string }[] = [
  { id: "chat", label: "AI Chat" },
  { id: "brief", label: "Brief" },
  { id: "script", label: "Script" },
  { id: "storyboard", label: "Storyboard" },
  { id: "characters", label: "Characters" },
  { id: "references", label: "References" },
  { id: "prompts", label: "Prompts" },
  { id: "models", label: "Providers" },
  { id: "production", label: "Production" },
  { id: "timeline", label: "Timeline" },
  { id: "assets", label: "Assets" },
];

export function CreativeSectionNav() {
  const section = useStudioStore((s) => s.creativeSection);
  const setSection = useStudioStore((s) => s.setCreativeSection);

  return (
    <ScrollArea className="w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex gap-1 px-2 py-1.5" data-testid="creative-section-nav">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-testid={`creative-section-${id}`}
            data-active={section === id ? "true" : "false"}
            onClick={() => setSection(id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              section === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
