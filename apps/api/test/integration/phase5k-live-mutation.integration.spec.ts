import { describe, expect, it } from "vitest";
import {
  apiJson,
  expectOk2xx,
  integrationCredentials,
  requireIntegrationEnv,
  signInIntegrationUser,
  type AuthSession,
} from "./http-helpers";

const LIVE = process.env.PHASE5K_LIVE_MUTATION_SMOKE === "1";

/** 1×1 PNG */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function resolveUploadUrl(url: string) {
  const base = process.env.INTEGRATION_S3_UPLOAD_BASE;
  if (!base || base.includes("minio")) return url;
  const u = new URL(url);
  return `${base.replace(/\/$/, "")}${u.pathname}${u.search}`;
}

async function uploadReadyPng(session: AuthSession, projectId: string): Promise<string> {
  const init = await apiJson<{
    sessionId: string;
    assetId: string;
    uploadUrl: string;
  }>("/api/v1/uploads/init", session, {
    method: "POST",
    body: JSON.stringify({
      projectId,
      filename: "phase5k-mutation.png",
      mimeType: "image/png",
      sizeBytes: png.length,
    }),
  });
  expectOk2xx(init.status);
  const put = await fetch(resolveUploadUrl(init.json.uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  expect(put.ok).toBe(true);
  const done = await apiJson<{ assetId: string }>(`/api/v1/uploads/${init.json.sessionId}/complete`, session, {
    method: "POST",
    body: JSON.stringify({}),
  });
  expectOk2xx(done.status);
  const assetId = init.json.assetId;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const assets = await apiJson<Array<{ id: string; status: string }>>(
      `/api/v1/projects/${projectId}/assets`,
      session,
    );
    expectOk2xx(assets.status);
    const row = assets.json.find((a) => a.id === assetId);
    if (row?.status === "READY") return assetId;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`asset ${assetId} not READY within timeout`);
}

type StoryboardPayload = {
  payload?: { scenes?: Array<{ sceneId: string; firstFrameAssetId?: string }> };
  scenes?: Array<{ sceneId: string; firstFrameAssetId?: string }>;
};

function storyboardScenes(doc: StoryboardPayload) {
  return doc.payload?.scenes ?? doc.scenes ?? [];
}

async function fetchStoryboard(session: AuthSession, projectId: string): Promise<StoryboardPayload> {
  const res = await fetch(`${process.env.INTEGRATION_API_URL ?? "http://127.0.0.1:3021"}/api/v1/projects/${projectId}/storyboard`, {
    headers: {
      Cookie: session.cookie,
      ...(process.env.STAGING_GATE_SECRET
        ? { "X-Shotbro-Staging-Gate": process.env.STAGING_GATE_SECRET }
        : {}),
    },
  });
  expect(res.ok).toBe(true);
  const text = await res.text();
  expect(text.trim().length).toBeGreaterThan(0);
  return JSON.parse(text) as StoryboardPayload;
}

describe.skipIf(!LIVE)("Phase 5K live mutation smoke (minimal spend, no media jobs)", () => {
  it("NL first frame on scene 2 persists across consecutive storyboard GETs (F5)", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    const ts = Date.now();
    const { status: createStatus, json: created } = await apiJson<{ id: string }>(
      "/api/v1/projects",
      session,
      { method: "POST", body: JSON.stringify({ title: `phase5k-mutation-${ts}`, settings: {} }) },
    );
    expectOk2xx(createStatus);
    const projectId = created.id;

    const { status: convStatus, json: conv } = await apiJson<{ id: string }>(
      `/api/v1/projects/${projectId}/conversations`,
      session,
      { method: "POST", body: JSON.stringify({ title: "Phase 5K mutation" }) },
    );
    expectOk2xx(convStatus);
    const conversationId = conv.id;

    for (let i = 0; i < 2; i++) {
      const add = await apiJson<{ sceneId?: string }>(`/api/v1/projects/${projectId}/scripts/scenes`, session, {
        method: "POST",
        body: JSON.stringify({ title: `Scene ${i + 1}` }),
      });
      expectOk2xx(add.status);
    }

    const sync = await apiJson<unknown>(`/api/v1/projects/${projectId}/storyboard/sync`, session, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expectOk2xx(sync.status);

    const assetId = await uploadReadyPng(session, projectId);

    let before = storyboardScenes(await fetchStoryboard(session, projectId));
    expect(before.length).toBeGreaterThanOrEqual(2);
    const secondSceneId = before[1]!.sceneId;

    const { status: turnStatus, json: turn } = await apiJson<{
      status: string;
      mockAgent?: boolean;
      llmLive?: boolean;
      results?: Array<{ toolName: string; success: boolean; sceneId?: string }>;
    }>(`/api/v1/projects/${projectId}/agent/creative-turn`, session, {
      method: "POST",
      body: JSON.stringify({
        userMessage: "Найди фото в библиотеке и установи первым кадром второй сцены",
        conversationId,
        idempotencyKey: `phase5k-mutation-${ts}`,
      }),
    });
    expectOk2xx(turnStatus);
    expect(turn.mockAgent).toBe(false);
    expect(turn.llmLive).toBe(true);
    if (turn.status === "failed") {
      throw new Error(
        `creative-turn failed: ${turn.error ?? "unknown"}; results=${JSON.stringify(turn.results?.slice(0, 4) ?? [])}`,
      );
    }
    expect(turn.status).toMatch(/completed|stopped/);
    const frameTool = turn.results?.find(
      (r) => r.toolName === "set_scene_first_frame_by_ordinal" && r.success,
    );
    expect(frameTool).toBeTruthy();

    const deadline = Date.now() + 120_000;
    let firstFrameAssetId = "";
    while (Date.now() < deadline) {
      before = storyboardScenes(await fetchStoryboard(session, projectId));
      const hit = before.find((s) => s.sceneId === secondSceneId);
      firstFrameAssetId = hit?.firstFrameAssetId ?? "";
      if (firstFrameAssetId === assetId) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(firstFrameAssetId).toBe(assetId);

    const afterReload = storyboardScenes(await fetchStoryboard(session, projectId));
    expect(afterReload.find((s) => s.sceneId === secondSceneId)?.firstFrameAssetId).toBe(firstFrameAssetId);

    const { json: jobs } = await apiJson<{ items: unknown[]; mock?: boolean }>(
      `/api/v1/projects/${projectId}/provider-jobs`,
      session,
    );
    expect(jobs.mock).toBe(true);
    expect(jobs.items?.length ?? 0).toBe(0);
  }, 180_000);
});

describe("Phase 5K live mutation smoke gate", () => {
  it("skipped unless PHASE5K_LIVE_MUTATION_SMOKE=1", () => {
    if (!LIVE) {
      expect(integrationCredentials("A").email).toBeTruthy();
    }
  });
});
