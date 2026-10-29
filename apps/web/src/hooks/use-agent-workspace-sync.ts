"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@shotbro/contracts";
import { useStudioStore } from "@/store/studio-store";
import { planAutoNav } from "@/lib/agent-auto-nav";

function composerHasFocus() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.getAttribute("data-testid") === "real-composer-input";
}

function envAutoNavEnabled() {
  return process.env.NEXT_PUBLIC_CREATIVE_AUTO_NAV !== "false";
}

/**
 * Module-level so it survives RealThread unmounting when the user leaves the chat section.
 * Tool results created before this page load are history and never auto-navigate.
 */
const PAGE_LOADED_AT = Date.now();
const seenToolResults = new Set<string>();

/** Phase 5L-5: optional auto-nav to creativeSection after successful agent tool results. */
export function useAgentWorkspaceAutoNav(messages: ChatMessage[]) {
  const autoNavigate = useStudioStore((s) => s.creativeAutoNavigate);
  const setSection = useStudioStore((s) => s.setCreativeSection);
  const setFocus = useStudioStore((s) => s.setAgentFocus);
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
    const plan = planAutoNav(messages, seenToolResults, PAGE_LOADED_AT);
    for (const key of plan.inert) seenToolResults.add(key);
    if (!plan.target) return;
    if (!envAutoNavEnabled() || !autoNavigate) {
      // Disabled: consume so re-enabling later does not replay old results.
      for (const key of plan.navigable) seenToolResults.add(key);
      return;
    }
    // User is typing: keep results pending and retry on the next focus change.
    if (composerHasFocus()) return;
    for (const key of plan.navigable) seenToolResults.add(key);
    setFocus({
      sceneId: plan.target.sceneId,
      assetId: plan.target.assetId,
      clipId: plan.target.clipId,
    });
    setSection(plan.target.creativeSection);
  }, [messages, autoNavigate, setFocus, setSection, focusEpoch]);
}
