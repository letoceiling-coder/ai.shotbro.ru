"use client";

import type { AgentToolResultBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";

type Block = z.infer<typeof AgentToolResultBlockSchema>;

export function AgentToolResultCard({ block }: { block: Block }) {
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const setFocus = useStudioStore((s) => s.setAgentFocus);

  const openDeepLink = () => {
    if (!block.deepLink) return;
    setFocus({
      sceneId: block.deepLink.sceneId,
      assetId: block.deepLink.assetId ?? block.assetId,
      clipId: block.deepLink.clipId,
    });
    setSection(block.deepLink.creativeSection as CreativeSection);
  };

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 text-sm"
      data-testid={`agent-tool-result-${block.toolName}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium">{block.toolName}</span>
        <Badge variant={block.success ? "success" : "outline"}>{block.success ? "OK" : "FAIL"}</Badge>
        <Badge variant="outline">{block.mockAgent === false ? "OpenRouter LLM" : "Mock-агент 5K"}</Badge>
      </div>
      <p className="text-muted-foreground">{block.humanReadableSummary}</p>
      {block.sceneId ? <p className="mt-1 text-xs text-muted-foreground">sceneId: {block.sceneId}</p> : null}
      {block.assetId ? <p className="text-xs text-muted-foreground">assetId: {block.assetId}</p> : null}
      {block.revision != null ? <p className="text-xs text-muted-foreground">revision: {block.revision}</p> : null}
      {block.deepLink ? (
        <Button type="button" size="sm" className="mt-3" variant="secondary" onClick={openDeepLink}>
          Открыть в Creative
        </Button>
      ) : null}
    </div>
  );
}
