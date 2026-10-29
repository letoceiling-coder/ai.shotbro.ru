import { describe, expect, it } from "vitest";
import { mimeMatchesDeclared, sniffMime } from "./mime-policy.js";

function wavHeader() {
  const b = Buffer.alloc(44);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(36, 4);
  b.write("WAVE", 8, "ascii");
  b.write("fmt ", 12, "ascii");
  return b;
}

describe("sniffMime", () => {
  it("recognises WAV voice samples (Phase 6 cloning)", () => {
    expect(sniffMime(wavHeader())).toBe("audio/wav");
    expect(mimeMatchesDeclared("audio/wav", sniffMime(wavHeader()))).toBe(true);
  });

  it("does not confuse WEBP (also RIFF) with WAV", () => {
    const webp = wavHeader();
    webp.write("WEBP", 8, "ascii");
    expect(sniffMime(webp)).toBe("image/webp");
  });
});
