import { describe, expect, it } from "vitest";
import { assetPlaybackRef, parseAssetPlaybackRef } from "@shotbro/contracts/asset-playback";

describe("asset-playback refs (5L-6)", () => {
  it("round-trips asset id without public URL", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const ref = assetPlaybackRef(id);
    expect(parseAssetPlaybackRef(ref)).toBe(id);
    expect(parseAssetPlaybackRef("https://bucket.example/x.mp4")).toBeNull();
  });
});
