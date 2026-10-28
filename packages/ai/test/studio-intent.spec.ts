import { describe, expect, it } from "vitest";
import {
  isProductionBootstrapUserMessage,
  resolveStudioMessageIntent,
  shouldTryCreativeTurn,
} from "../src/agent/studio-intent.js";

const PRODUCTION_PROMPT =
  "Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo";

describe("studio-intent (5L-A)", () => {
  it("production bootstrap wins over creative keywords", () => {
    expect(resolveStudioMessageIntent(PRODUCTION_PROMPT)).toBe("production_bootstrap");
    expect(shouldTryCreativeTurn(PRODUCTION_PROMPT)).toBe(false);
    expect(isProductionBootstrapUserMessage(PRODUCTION_PROMPT)).toBe(true);
  });

  it("routes phase5k and library NL to creative_nl", () => {
    expect(resolveStudioMessageIntent("phase5k найди фото")).toBe("creative_nl");
    expect(resolveStudioMessageIntent("Найди фото в библиотеке")).toBe("creative_nl");
    expect(resolveStudioMessageIntent("Установи первым кадром второй сцены")).toBe("creative_nl");
  });

  it("defaults ambiguous text to production_default", () => {
    expect(resolveStudioMessageIntent("Привет, как дела?")).toBe("production_default");
    expect(resolveStudioMessageIntent("Измени второй кадр сцены")).toBe("production_default");
  });
});
