import { describe, expect, it } from "vitest";
import { assetPlaybackRef, parseAssetPlaybackRef } from "../src/asset-playback";

describe("asset-playback refs", () => {
  it("round-trips asset id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const ref = assetPlaybackRef(id);
    expect(ref).toContain("shotbro-asset://");
    expect(parseAssetPlaybackRef(ref)).toBe(id);
  });

  it("rejects public http urls", () => {
    expect(parseAssetPlaybackRef("https://evil.example/v.mp4")).toBeNull();
  });
});
