import type { Page } from "@playwright/test";

/** Keep REAL mode + active project after full page reload (Playwright does not restore Zustand). */
export async function pinRealProjectOnReload(
  page: Page,
  projectId: string,
  section:
    | "models"
    | "chat"
    | "brief"
    | "storyboard"
    | "characters"
    | "references"
    | "prompts"
    | "timeline"
    | "script"
    | "production"
    | "assets"
    | "voices"
    | "avatars"
    | "canvas" = "models",
  options?: { creativeAutoNavigate?: boolean },
) {
  await page.evaluate(
    ([pid, sec, autoNav]) => {
      localStorage.setItem("shotbro-studio-mode-v1", "REAL");
      const key = "shotbro-studio-demo-v1";
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }) : { state: {} };
      const next: Record<string, unknown> = {
        ...(parsed.state ?? {}),
        activeRealProjectId: pid,
        creativeSection: sec,
      };
      if (autoNav !== null) next.creativeAutoNavigate = autoNav;
      parsed.state = next;
      localStorage.setItem(key, JSON.stringify(parsed));
    },
    [projectId, section, options?.creativeAutoNavigate ?? null] as const,
  );
}
