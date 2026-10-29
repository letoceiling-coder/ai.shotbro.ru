"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@shotbro/contracts";
import type { AgentToolResultBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";

type AgentToolBlock = z.infer<typeof AgentToolResultBlockSchema>;

function isAgentToolBlock(block: { type: string }): block is AgentToolBlock {
  return block.type === "agent_tool_result";
}
import { useStudioStore, type CreativeSection } from "@/store/studio-store";

function composerHasFocus() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.getAttribute("data-testid") === "real-composer-input";
}

function envAutoNavEnabled() {
  return process.env.NEXT_PUBLIC_CREATIVE_AUTO_NAV !== "false";
}

/** Phase 5L-5: optional auto-nav to creativeSection after successful agent tool results. */
export function useAgentWorkspaceAutoNav(messages: ChatMessage[]) {
  const autoNavigate = useStudioStore((s) => s.creativeAutoNavigate);
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const setFocus = useStudioStore((s) => s.setAgentFocus);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!envAutoNavEnabled() || !autoNavigate) return;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const block of msg.blocks ?? []) {
        if (!isAgentToolBlock(block)) continue;
        const key = `${msg.id}:${block.toolName}:${block.sceneId ?? ""}:${block.assetId ?? ""}`;
        if (seen.current.has(key)) continue;
        seen.current.add(key);
        if (!block.success || !block.deepLink) continue;
        if (composerHasFocus()) continue;
        setFocus({
          sceneId: block.deepLink.sceneId,
          assetId: block.deepLink.assetId ?? block.assetId,
          clipId: block.deepLink.clipId,
        });
        setSection(block.deepLink.creativeSection as CreativeSection);
      }
    }
  }, [messages, autoNavigate, setFocus, setSection]);
}
