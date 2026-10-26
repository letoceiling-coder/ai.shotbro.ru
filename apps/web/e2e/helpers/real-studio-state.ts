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
    | "assets" = "models",
) {
  await page.evaluate(
    ([pid, sec]) => {
      localStorage.setItem("shotbro-studio-mode-v1", "REAL");
      const key = "shotbro-studio-demo-v1";
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }) : { state: {} };
      parsed.state = { ...(parsed.state ?? {}), activeRealProjectId: pid, creativeSection: sec };
      localStorage.setItem(key, JSON.stringify(parsed));
    },
    [projectId, section] as const,
  );
}
