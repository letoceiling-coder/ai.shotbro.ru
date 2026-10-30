import { describe, expect, it } from "vitest";
import { downmixToMono, encodeWav, formatSeconds, resample, rmsLevel } from "./wav";

describe("wav helpers (browser voice recording)", () => {
  it("encodes a valid 16-bit mono PCM header", () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 24000);
    const v = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(...wav.slice(o, o + 4));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(36)).toBe("data");
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint32(40, true)).toBe(8);
    expect(v.getInt16(46, true)).toBe(Math.round(0.5 * 0x7fff - 0.5));
    expect(wav.length).toBe(44 + 8);
  });

  it("downmixes and resamples", () => {
    expect([...downmixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])])]).toEqual([0.5, 0.5]);
    expect(resample(new Float32Array(48000), 48000, 24000).length).toBe(24000);
  });

  it("level meter and timer", () => {
    expect(rmsLevel(new Float32Array(10))).toBe(0);
    expect(rmsLevel(new Float32Array([1, -1]))).toBe(1);
    expect(formatSeconds(75.4)).toBe("1:15");
  });
});
