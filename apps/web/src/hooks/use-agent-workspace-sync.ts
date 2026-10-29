"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@shotbro/contracts";
import type { AgentToolResultBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";

type AgentToolBlock = z.infer<typeof AgentToolResultBlockSchema>;

function isAgentToolBlock(block: { type: string }): block is AgentToolBlock {
  return block.type === "agent_tool_result";
}

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
  const [focusEpoch, setFocusEpoch] = useState(0);

  useEffect(() => {
    const bump = () => setFocusEpoch((n) => n + 1);
    document.addEventListener("focusin", bump);
    document.addEventListener("focusout", bump);
    return () => {
      document.removeEventListener("focusin", bump);
      document.removeEventListener("focusout", bump);
    };
  }, []);

  useEffect(() => {
    if (!envAutoNavEnabled() || !autoNavigate) return;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const block of msg.blocks ?? []) {
        if (!isAgentToolBlock(block)) continue;
        const key = `${msg.id}:${block.toolName}:${block.sceneId ?? ""}:${block.assetId ?? ""}`;
        if (seen.current.has(key)) continue;
        if (!block.success || !block.deepLink) {
          seen.current.add(key);
          continue;
        }
        if (composerHasFocus()) continue;
        seen.current.add(key);
        setFocus({
          sceneId: block.deepLink.sceneId,
          assetId: block.deepLink.assetId ?? block.assetId,
          clipId: block.deepLink.clipId,
        });
        setSection(block.deepLink.creativeSection as CreativeSection);
      }
    }
  }, [messages, autoNavigate, setFocus, setSection, focusEpoch]);
}
