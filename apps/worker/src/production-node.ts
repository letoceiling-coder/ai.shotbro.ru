import type { Logger } from "pino";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runProductionNode(
  data: { nodeId: string; projectId: string; runId: string; nodeType: string; mock?: boolean },
  log: Logger,
) {
  log.info({ ...data }, "production.node start");
  if (data.nodeType === "ASSEMBLY") {
    return runMockFfmpegAssembly(data, log);
  }
  await sleep(50);
  return {
    nodeId: data.nodeId,
    status: "COMPLETED",
    mock: true,
    fixture: data.nodeType.includes("VIDEO") ? "mock/fixture-640x360.mp4" : "mock/fixture-640x360.png",
  };
}

async function runMockFfmpegAssembly(
  data: { nodeId: string; projectId: string; runId: string },
  log: Logger,
) {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
    log.info("ffmpeg available for mock assembly");
  } catch {
    log.warn("ffmpeg not available — mock assembly metadata only");
  }
  return {
    nodeId: data.nodeId,
    status: "COMPLETED",
    mock: true,
    delivery: { format: "mp4", aspectRatio: "9:16", durationSeconds: 15 },
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
