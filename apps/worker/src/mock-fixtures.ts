import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export async function ensureMockFixtures(log: { info: (o: unknown, msg?: string) => void }) {
  await mkdir(root, { recursive: true });
  const imagePath = join(root, "scene.png");
  const videoPath = join(root, "scene.mp4");
  const audioPath = join(root, "voice.mp3");
  const logoPath = join(root, "logo.png");

  if (!(await exists(imagePath))) {
    await sharp({
      create: { width: 720, height: 1280, channels: 3, background: { r: 30, g: 30, b: 40 } },
    })
      .png()
      .toFile(imagePath);
  }
  if (!(await exists(logoPath))) {
    await sharp({
      create: { width: 200, height: 80, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.9 } },
    })
      .png()
      .toFile(logoPath);
  }
  if (!(await exists(videoPath))) {
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=0x1e1e28:s=720x1280:d=2",
          "-t",
          "2",
          "-pix_fmt",
          "yuv420p",
          videoPath,
        ],
        { timeout: 30_000 },
      );
    } catch {
      await writeFile(videoPath, Buffer.alloc(0));
      log.info("ffmpeg unavailable — empty video fixture placeholder");
    }
  }
  if (!(await exists(audioPath))) {
    try {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", audioPath],
        { timeout: 30_000 },
      );
    } catch {
      await writeFile(audioPath, Buffer.alloc(0));
    }
  }

  return { root, imagePath, videoPath, audioPath, logoPath };
}

export async function readFixture(name: "scene.png" | "scene.mp4" | "voice.mp3" | "logo.png") {
  const path = join(root, name);
  return readFile(path);
}

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
