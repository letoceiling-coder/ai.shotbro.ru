/**
 * Unified REAL studio chat routing (Phase 5L-A).
 * Web and API must use the same rules — import from @shotbro/ai.
 */

export type StudioMessageIntent = "production_bootstrap" | "creative_nl" | "production_default";

/** Phase 3/4 mock production E2E bootstrap — must route to AgentRuntime, not OpenRouter creative loop. */
export function isProductionBootstrapUserMessage(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return (
    (lower.includes("ролик") || lower.includes("реклам")) &&
    (lower.includes("15") || lower.includes("9:16") || lower.includes("testco") || lower.includes("mock"))
  );
}

/** @deprecated Use isProductionBootstrapUserMessage */
export const isProductionBootstrapMessage = isProductionBootstrapUserMessage;

/** NL patterns that should hit POST /agent/creative-turn before production fallback. */
export function shouldTryCreativeTurn(content: string): boolean {
  if (isProductionBootstrapUserMessage(content)) return false;
  const lower = content.toLowerCase();
  if (lower.includes("phase5k")) return true;
  return (
    lower.includes("библиотек") ||
    lower.includes("first_frame") ||
    lower.includes("первым кадром") ||
    lower.includes("раскадров") ||
    lower.includes("timeline") ||
    lower.includes("монтаж") ||
    (lower.includes("покажи") && (lower.includes("фото") || lower.includes("фотограф") || lower.includes("изображ"))) ||
    (lower.includes("найди") && (lower.includes("фото") || lower.includes("изображ") || lower.includes("видео"))) ||
    (lower.includes("улучши") && (lower.includes("промпт") || lower.includes("prompt") || lower.includes("видео")))
  );
}

/** Single entry point for web send path and documentation. */
export function resolveStudioMessageIntent(content: string): StudioMessageIntent {
  if (isProductionBootstrapUserMessage(content)) return "production_bootstrap";
  if (shouldTryCreativeTurn(content)) return "creative_nl";
  return "production_default";
}
