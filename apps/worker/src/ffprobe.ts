import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

type ProbeResult = {
  width?: number;
  height?: number;
  durationMs?: number;
  codec?: string;
};

export async function probeMediaBuffer(buffer: Buffer, ext: string): Promise<ProbeResult> {
  const dir = await mkdtemp(join(tmpdir(), "shotbro-probe-"));
  const file = join(dir, `input.${ext}`);
  try {
    await writeFile(file, buffer);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      file,
    ]);
    const json = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
    };
    const video = json.streams?.find((s) => s.codec_type === "video");
    const durationSec = json.format?.duration ? Number(json.format.duration) : undefined;
    return {
      width: video?.width,
      height: video?.height,
      codec: video?.codec_name,
      durationMs: durationSec ? Math.round(durationSec * 1000) : undefined,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractVideoPoster(buffer: Buffer, ext: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "shotbro-poster-"));
  const input = join(dir, `input.${ext}`);
  const output = join(dir, "poster.jpg");
  try {
    await writeFile(input, buffer);
    await execFileAsync("ffmpeg", ["-y", "-i", input, "-frames:v", "1", "-q:v", "2", output]);
    const { readFile } = await import("node:fs/promises");
    return readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
