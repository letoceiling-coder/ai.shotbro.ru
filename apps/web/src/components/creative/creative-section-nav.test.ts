import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./creative-section-nav";

const ALL_SECTIONS = [
  "chat", "brief", "script", "storyboard", "characters", "references", "prompts",
  "models", "production", "timeline", "assets", "voices", "avatars",
];

describe("creative navigation", () => {
  it("has six Russian groups", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Чат", "Сценарий", "Персонажи", "Монтаж", "Материалы", "Модели"]);
  });

  it("keeps a button for every section exactly once", () => {
    const ids = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect([...ids].sort()).toEqual([...ALL_SECTIONS].sort());
  });
});
