/** Mirrors production bootstrap detection in @shotbro/ai creative planner (web has no ai package dep). */
export function isProductionBootstrapMessage(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    (lower.includes("ролик") || lower.includes("реклам")) &&
    (lower.includes("15") || lower.includes("9:16") || lower.includes("testco") || lower.includes("mock"))
  );
}

export function shouldTryCreativeTurn(content: string): boolean {
  const lower = content.toLowerCase();
  if (lower.includes("phase5k")) return true;
  if (isProductionBootstrapMessage(content)) return true;
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
