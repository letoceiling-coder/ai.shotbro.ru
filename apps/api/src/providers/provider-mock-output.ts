/** Minimal 1×1 PNG (no filesystem dependency in Docker). */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Bundled bytes for mock provider completion (no external AI). */
export function mockProviderOutputBytes(providerId: string): {
  bytes: Buffer;
  mimeType: string;
  originalName: string;
} {
  if (providerId === "mock-video") {
    return { bytes: TINY_PNG, mimeType: "video/mp4", originalName: "mock-scene.mp4" };
  }
  if (providerId === "mock-elevenlabs") {
    return { bytes: Buffer.from("MOCK-AUDIO"), mimeType: "audio/mpeg", originalName: "mock-voice.mp3" };
  }
  return { bytes: TINY_PNG, mimeType: "image/png", originalName: "mock-scene.png" };
}
