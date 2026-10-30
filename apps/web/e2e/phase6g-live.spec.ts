import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

/**
 * Phase 6G — REAL paid generations (run only inside the live window, see docs/PHASE6G-LIVE-TEST-PROTOCOL.md).
 * Customer rule: minimal spend — clips and voice ≤ 5 s; theme: ad campaign for shotbro.ru.
 * Nothing is faked: the test refuses to run unless the studio reports live mode, and each paid step
 * goes through the same price card → approval as a user would.
 *
 * Resume without paying twice: E2E_6G_PROJECT_ID=<project> reuses completed steps of an earlier run;
 * E2E_6G_SKIP_TTS=1 skips the ElevenLabs voice-over (e.g. while the API key's IP allowlist blocks us).
 */

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

type Run = { id: string; status: string; assetId: string | null; mimeType: string | null; providerId: string; failureCode: string | null; mock: boolean };
type CanvasView = {
  version: number;
  mock: boolean;
  scenes: Array<{ sceneId: string; order: number }>;
  runs: Record<string, Run[]>;
  payload: {
    nodes: Array<{ id: string; kind: string; position: { x: number; y: number }; sceneId?: string; data: Record<string, unknown> }>;
    edges: Array<{ id: string; source: string; target: string }>;
    viewport: { x: number; y: number; zoom: number };
  };
};
type Quote = { approvalId: string; targetVersion: string; payloadHash: string; totalEstimatedLiveUsd: number; totalChargedUsd: number; mock: boolean; items: Array<{ nodeId: string; providerId: string; estimatedLiveUsd: number }> };
type DoneRun = Run & { nodeId: string };

const report: Array<Record<string, unknown>> = [];
const RESUME_PROJECT = process.env.E2E_6G_PROJECT_ID?.trim() || "";
const SKIP_TTS = process.env.E2E_6G_SKIP_TTS === "1";
/** Node ids to run again even when resuming (e.g. "assembly" after a fix to the cut). */
const RERUN = new Set((process.env.E2E_6G_RERUN ?? "").split(",").map((x) => x.trim()).filter(Boolean));

async function api<T>(page: Page, method: "get" | "post" | "patch" | "put", url: string, data?: unknown): Promise<T> {
  const res = await page.request[method](url, data === undefined ? undefined : { data });
  expect(res.ok(), `${method.toUpperCase()} ${url} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T;
}

const canvas = (page: Page, projectId: string) => api<CanvasView>(page, "get", `/api/v1/projects/${projectId}/canvas`);

async function addNodes(page: Page, projectId: string, nodes: CanvasView["payload"]["nodes"], edges: CanvasView["payload"]["edges"]) {
  const v = await canvas(page, projectId);
  const have = new Set(v.payload.nodes.map((n) => n.id));
  const haveEdges = new Set(v.payload.edges.map((e) => e.id));
  await api(page, "put", `/api/v1/projects/${projectId}/canvas`, {
    expectedVersion: v.version,
    nodes: [...v.payload.nodes, ...nodes.filter((n) => !have.has(n.id))],
    edges: [...v.payload.edges, ...edges.filter((e) => !haveEdges.has(e.id))],
    viewport: v.payload.viewport,
  });
}

/** Latest real (non-mock) completed run of each node, if all exist — used to resume without paying again. */
function completedLive(v: CanvasView, nodeIds: string[]): DoneRun[] | null {
  const out: DoneRun[] = [];
  for (const id of nodeIds) {
    const r = (v.runs[id] ?? []).find((x) => x.status === "COMPLETED" && !x.mock && x.assetId);
    if (!r) return null;
    out.push({ ...r, nodeId: id });
  }
  return out;
}

/** One paid step: price card → check caps → approve → wait for the real result. */
async function runPaid(page: Page, projectId: string, label: string, nodeIds: string[], maxUsd: number, timeoutMs = 20 * 60_000): Promise<DoneRun[]> {
  const prior = completedLive(await canvas(page, projectId), nodeIds);
  if (prior && RESUME_PROJECT && !nodeIds.some((id) => RERUN.has(id))) {
    report.push({ step: label, reused: true, runs: prior.map((r) => ({ node: r.nodeId, mime: r.mimeType })) });
    console.log("6G_STEP", JSON.stringify(report.at(-1)));
    return prior;
  }
  const q = await api<Quote>(page, "post", `/api/v1/projects/${projectId}/canvas/quote`, { nodeIds });
  expect(q.mock, "studio must be in live mode").toBe(false);
  expect(q.totalChargedUsd).toBeLessThanOrEqual(maxUsd);
  await api(page, "post", `/api/v1/approvals/${q.approvalId}/approve`, { expectedVersion: q.targetVersion, payloadHash: q.payloadHash });
  const started = Date.now();
  let last: CanvasView | undefined;
  await expect
    .poll(
      async () => {
        last = await canvas(page, projectId);
        const states = nodeIds.map((id) => last!.runs[id]?.[0]?.status ?? "none");
        if (states.includes("FAILED")) return "FAILED";
        return states.every((s) => s === "COMPLETED") ? "COMPLETED" : "WAIT";
      },
      { timeout: timeoutMs, intervals: [5000, 10_000, 15_000] },
    )
    .not.toBe("WAIT");
  const runs = nodeIds.map((id) => ({ nodeId: id, ...last!.runs[id]![0]! }));
  report.push({ step: label, quotedUsd: q.totalEstimatedLiveUsd, seconds: Math.round((Date.now() - started) / 1000), runs: runs.map((r) => ({ node: r.nodeId, status: r.status, provider: r.providerId, mime: r.mimeType, failure: r.failureCode })) });
  console.log("6G_STEP", JSON.stringify(report.at(-1)));
  for (const r of runs) {
    expect(r.status, `${label}: ${r.nodeId} failed (${r.failureCode})`).toBe("COMPLETED");
    expect(r.mock).toBe(false);
  }
  return runs;
}

async function assetInfo(page: Page, id: string) {
  return api<{ mimeType: string; sizeBytes: number; status: string }>(page, "get", `/api/v1/assets/${id}`);
}

test.describe("Phase 6G live generations (minimal spend)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND || process.env.E2E_6G_LIVE !== "1", "Only inside the 6G live window (E2E_6G_LIVE=1)");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loginRealUser(page);
    loggedInStorage = await context.storageState();
    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    if (loggedInStorage?.cookies.length) await context.addCookies(loggedInStorage.cookies);
  });

  test("frame → 5 s video → voice-over → avatar video → cut, all real", async ({ page }) => {
    test.setTimeout(75 * 60_000);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    // Live mode or nothing.
    const chain = await api<{ mockMode: boolean }>(page, "get", "/api/v1/talent/provider-chain?capability=SCENE_VIDEO");
    expect(chain.mockMode, "studio must be in live mode").toBe(false);

    let projectId = RESUME_PROJECT;
    let scene: string;
    if (projectId) {
      const v = await canvas(page, projectId);
      expect(v.mock).toBe(false);
      expect(v.scenes).toHaveLength(1);
      scene = v.scenes[0]!.sceneId;
    } else {
      projectId = await openRealNewProject(page);
      await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });

      // One scene, 5 s, ad for shotbro.ru (the starter scene of an empty project is removed).
      await api(page, "post", `/api/v1/projects/${projectId}/scripts/scenes`, { title: "ShotBro: ролик за минуту" });
      const script = await api<{ payload: { scenes: Array<{ id: string; title: string }> } }>(page, "get", `/api/v1/projects/${projectId}/script`);
      scene = script.payload.scenes.find((x) => x.title === "ShotBro: ролик за минуту")!.id;
      for (const other of script.payload.scenes.filter((x) => x.id !== scene)) {
        await api(page, "post", `/api/v1/projects/${projectId}/scripts/scenes/${other.id}/delete`, {});
      }
      await api(page, "post", `/api/v1/projects/${projectId}/storyboard/sync`, {});
      const sb = await api<{ payload: { scenes: Array<{ sceneId: string; revision: number }> } }>(page, "get", `/api/v1/projects/${projectId}/storyboard`);
      expect(sb.payload.scenes.map((x) => x.sceneId)).toEqual([scene]);
      await api(page, "patch", `/api/v1/projects/${projectId}/storyboard/scenes/${scene}`, {
        expectedRevision: sb.payload.scenes[0]!.revision,
        firstFramePrompt:
          "Vertical 9:16 ad frame: a smartphone on a dark violet desk showing a video editor with the text SHOTBRO, neon purple light, clean modern product shot, no people",
        videoMotionPrompt: "slow push-in on the phone screen, subtle neon light flicker",
      });

      // Canvas: only this scene's chain (drop nodes of removed scenes), clip length 5 s.
      let v = await canvas(page, projectId);
      expect(v.mock).toBe(false);
      const keepNode = (n: { sceneId?: string }) => !n.sceneId || n.sceneId === scene;
      const kept = new Set(v.payload.nodes.filter(keepNode).map((n) => n.id));
      await api(page, "put", `/api/v1/projects/${projectId}/canvas`, {
        expectedVersion: v.version,
        nodes: v.payload.nodes.filter(keepNode).map((n) => (n.id === `scene:${scene}:video` ? { ...n, data: { ...n.data, durationSeconds: 5 } } : n)),
        edges: v.payload.edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
        viewport: v.payload.viewport,
      });
      v = await canvas(page, projectId);
      expect(v.payload.nodes.filter((n) => n.sceneId).map((n) => n.id).sort()).toEqual(
        [`scene:${scene}:frame`, `scene:${scene}:prompt`, `scene:${scene}:video`].sort(),
      );
    }
    console.log("6G_PROJECT", projectId);

    // 1) First frame (OpenRouter image, ≈ $0.02) + fictional presenter portrait for the avatar (no real person).
    await addNodes(
      page,
      projectId,
      [
        { id: "presenter-prompt", kind: "prompt", position: { x: 0, y: 600 }, data: { text: "Vertical 9:16 photo portrait of a friendly fictional young presenter, looking at camera, studio light, plain violet background, head and shoulders" } },
        { id: "presenter-photo", kind: "first_frame", position: { x: 340, y: 600 }, data: {} },
      ],
      [{ id: "e:presenter-prompt->presenter-photo", source: "presenter-prompt", target: "presenter-photo" }],
    );
    const [frame, portrait] = await runPaid(page, projectId, "first_frame x2", [`scene:${scene}:frame`, "presenter-photo"], 0.1, 5 * 60_000);
    for (const r of [frame!, portrait!]) expect((await assetInfo(page, r.assetId!)).mimeType).toMatch(/^image\//);

    // 2) Scene video 5 s, 480p (≈ $0.11).
    const [clip] = await runPaid(page, projectId, "scene_video 5s", [`scene:${scene}:video`], 0.2);
    const clipInfo = await assetInfo(page, clip!.assetId!);
    expect(clipInfo.mimeType).toBe("video/mp4");
    expect(clipInfo.sizeBytes).toBeGreaterThan(10_000);

    // 3) Voice-over ≤ 5 s with a real ElevenLabs catalog voice (credits of the paid plan).
    if (SKIP_TTS) {
      report.push({ step: "tts ≤5s", skipped: "E2E_6G_SKIP_TTS=1 (ElevenLabs key IP allowlist)" });
      console.log("6G_STEP", JSON.stringify(report.at(-1)));
    } else {
      const library = await api<{ items: Array<{ providerVoiceId: string; name: string; labels?: { language?: string } }>; mock: boolean }>(page, "get", "/api/v1/voices/library");
      expect(library.mock).toBe(false);
      expect(library.items.length, "ElevenLabs catalog is empty — check API key / IP allowlist").toBeGreaterThan(0);
      const pick = library.items.find((x) => x.labels?.language === "ru") ?? library.items[0]!;
      const voice = await api<{ id: string; status: string }>(page, "post", "/api/v1/voices", { kind: "LIBRARY", name: `6G ${pick.name}`, providerVoiceId: pick.providerVoiceId });
      expect(voice.status).toBe("READY");
      const line = "ShotBro — ролик за минуту. Заходите на shotbro.ru"; // ≈ 3.5 s
      await addNodes(
        page,
        projectId,
        [
          { id: "vo-text", kind: "prompt", position: { x: 0, y: 900 }, data: { text: line } },
          { id: "vo-voice", kind: "voice", position: { x: 0, y: 1050 }, data: { voiceProfileId: voice.id } },
          { id: "vo", kind: "tts", position: { x: 340, y: 950 }, data: {} },
        ],
        [
          { id: "e:vo-text->vo", source: "vo-text", target: "vo" },
          { id: "e:vo-voice->vo", source: "vo-voice", target: "vo" },
          { id: "e:vo->assembly", source: "vo", target: "assembly" },
        ],
      );
      const [vo] = await runPaid(page, projectId, "tts ≤5s", ["vo"], 0.05, 3 * 60_000);
      expect((await assetInfo(page, vo!.assetId!)).mimeType).toBe("audio/mpeg");
    }

    // 4) Avatar video from the generated (fictional) portrait, script ≤ 5 s (OpenRouter heygen/avatar-iv ≈ $0.25).
    const avatar = await api<{ id: string; kind: string }>(page, "post", "/api/v1/avatars", { name: "6G ведущий (вымышленный)", sourceAssetIds: [portrait!.assetId] });
    expect(avatar.kind).toBe("REFERENCE");
    await api(page, "post", "/api/v1/talent/operations", { projectId, operation: "AVATAR_TRAIN", avatarProfileId: avatar.id });
    await expect.poll(async () => (await api<{ status: string }>(page, "get", `/api/v1/avatars/${avatar.id}`)).status, { timeout: 30_000 }).toBe("READY");
    await addNodes(
      page,
      projectId,
      [
        { id: "host-avatar", kind: "avatar", position: { x: 0, y: 1250 }, data: { avatarProfileId: avatar.id } },
        { id: "host-line", kind: "prompt", position: { x: 0, y: 1400 }, data: { text: "Привет! ShotBro делает ролики за минуту." } },
        { id: "host-video", kind: "avatar_video", position: { x: 340, y: 1300 }, data: { durationSeconds: 5 } },
      ],
      [
        { id: "e:host-avatar->host-video", source: "host-avatar", target: "host-video" },
        { id: "e:host-line->host-video", source: "host-line", target: "host-video" },
        { id: "e:host-video->assembly", source: "host-video", target: "assembly" },
      ],
    );
    const [host] = await runPaid(page, projectId, "avatar_video ≤5s", ["host-video"], 0.3);
    expect((await assetInfo(page, host!.assetId!)).mimeType).toBe("video/mp4");

    // 5) Final cut on our server (free): scene clip + avatar clip (+ voice-over when present).
    const [cut] = await runPaid(page, projectId, "assembly", ["assembly"], 0);
    const cutInfo = await assetInfo(page, cut!.assetId!);
    expect(cutInfo.mimeType).toBe("video/mp4");
    console.log("6G_REPORT", JSON.stringify({ projectId, steps: report }));
  });
});
