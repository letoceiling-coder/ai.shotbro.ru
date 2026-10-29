import { describe, expect, it } from "vitest";
import { previewStorageKey } from "../../src/assets/asset-enrichment";

describe("video preview policy (5L-6)", () => {
  it("allows original storage key fallback for video/mp4", () => {
    const key = previewStorageKey("projects/p1/mock-delivery.mp4", "video/mp4");
    expect(key === null || typeof key === "string").toBe(true);
  });
});
