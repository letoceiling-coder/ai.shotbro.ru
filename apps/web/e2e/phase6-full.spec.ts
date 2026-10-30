import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { uploadTinyImage } from "./helpers/phase5-creative-seed";
import { loginRealUser, openRealNewProject, sendRealComposerMessage } from "./helpers/real-login";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";
import { approveNextPendingViaUi } from "./helpers/ui-approvals";
import { fetchConversationMessages } from "./helpers/real-ui-sync";

/**
 * Phase 6F acceptance (spec §10): idea → avatar → voice → scenes → canvas → assembly → MP4 in chat,
 * driven through the chat agent with approval in the chat. Mock mode only ($0).
 * The `phase6f` marker routes the chat message to the deterministic planner (same tools as the LLM).
 */

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

type Run = { status: string; assetId: string | null; mimeType: string | null };
type CanvasView = {
  version: number;
  scenes: Array<{ sceneId: string; order: number }>;
  runs: Record<string, Run[]>;
  payload: {
    nodes: Array<{ id: string; kind: string; position: { x: number; y: number }; sceneId?: string; data: Record<string, unknown> }>;
    edges: Array<{ id: string; source: string; target: string }>;
    viewport: { x: number; y: number; zoom: number };
  };
};

async function api<T>(page: Page, method: "get" | "post" | "patch" | "put", url: string, data?: unknown): Promise<T> {
  const res = await page.request[method](url, data === undefined ? undefined : { data });
  expect(res.ok(), `${method.toUpperCase()} ${url} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T;
}

async function waitAssetReady(page: Page, assetId: string) {
  await expect
    .poll(async () => ((await (await page.request.get(`/api/v1/assets/${assetId}`)).json()) as { status: string }).status, {
      timeout: 90_000,
    })
    .toBe("READY");
}

async function conversationId(page: Page, projectId: string) {
  let id = "";
  await expect
    .poll(async () => {
      const body = await api<{ items?: Array<{ id: string }> } | Array<{ id: string }>>(page, "get", `/api/v1/projects/${projectId}/conversations`);
      const list = Array.isArray(body) ? body : (body.items ?? []);
      id = list[0]?.id ?? "";
      return id;
    }, { timeout: 60_000 })
    .not.toBe("");
  return id;
}

/** Canvas MP4 cards in the chat (from the worker after «Монтаж»). */
async function canvasDeliveries(page: Page, cid: string) {
  const msgs = await fetchConversationMessages(page, cid);
  return msgs.flatMap((m) =>
    ((m.blocks ?? []) as Array<{ type?: string; title?: string; assetId?: string }>).filter(
      (b) => b.type === "video_result" && (b.title ?? "").includes("холста"),
    ),
  );
}

test.describe("Phase 6F full mock scenario", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");
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

  test("idea → avatar + voice → canvas → agent proposes → approve in chat → MP4 in chat → redo one scene", async ({ page }) => {
    test.setTimeout(12 * 60_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectId = await openRealNewProject(page);
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
    const cid = await conversationId(page, projectId);

    // 1) Idea → scenes (shotbro.ru ad campaign).
    for (const title of ["ShotBro: идея за минуту", "ShotBro: ведущий рассказывает", "ShotBro: призыв на сайт"]) {
      await api(page, "post", `/api/v1/projects/${projectId}/scripts/scenes`, { title });
    }
    await api(page, "post", `/api/v1/projects/${projectId}/storyboard/sync`, {});

    // 2) Avatar (photo → looks, free without HeyGen) + voice from the catalog (free) → character.
    const photoId = await uploadTinyImage(page, projectId);
    await waitAssetReady(page, photoId);
    const library = await api<{ items: Array<{ providerVoiceId: string; name: string }> }>(page, "get", "/api/v1/voices/library");
    const voice = await api<{ id: string; status: string }>(page, "post", "/api/v1/voices", {
      kind: "LIBRARY",
      name: `Ведущий 6F ${Date.now().toString(36)}`,
      providerVoiceId: library.items[0]!.providerVoiceId,
    });
    expect(voice.status).toBe("READY");
    const avatar = await api<{ id: string; kind: string }>(page, "post", "/api/v1/avatars", {
      name: `Ведущий 6F ${Date.now().toString(36)}`,
      sourceAssetIds: [photoId],
      defaultVoiceProfileId: voice.id,
    });
    // Staging has no HeyGen key (customer decision): photos become looks for free, no consent/training.
    expect(avatar.kind, "6F expects REFERENCE avatars (no HEYGEN_API_KEY on staging)").toBe("REFERENCE");
    await api(page, "post", "/api/v1/talent/operations", { projectId, operation: "AVATAR_TRAIN", avatarProfileId: avatar.id });
    await expect
      .poll(async () => (await api<{ status: string }>(page, "get", `/api/v1/avatars/${avatar.id}`)).status, { timeout: 30_000 })
      .toBe("READY");
    const character = await api<{ id: string }>(page, "post", `/api/v1/projects/${projectId}/characters`, { name: "Ведущий ShotBro" });
    await api(page, "patch", `/api/v1/projects/${projectId}/characters/${character.id}/talent`, {
      voiceProfileId: voice.id,
      avatarProfileId: avatar.id,
    });

    // 3) Canvas: built from the storyboard; add «Видео с аватаром» (character + line) into the final cut.
    const view = await api<CanvasView>(page, "get", `/api/v1/projects/${projectId}/canvas`);
    expect(view.scenes.length).toBeGreaterThanOrEqual(3);
    const nodes = [
      ...view.payload.nodes,
      { id: "char-host", kind: "character", position: { x: 0, y: 900 }, data: { characterId: character.id } },
      { id: "line-host", kind: "prompt", position: { x: 0, y: 1100 }, data: { text: "Привет! Это ShotBro — ролик за минуту. Заходите на shotbro.ru" } },
      { id: "avatar-video", kind: "avatar_video", position: { x: 680, y: 1000 }, data: { durationSeconds: 3 } },
    ];
    const edges = [
      ...view.payload.edges,
      { id: "e:char-host->avatar-video", source: "char-host", target: "avatar-video" },
      { id: "e:line-host->avatar-video", source: "line-host", target: "avatar-video" },
      { id: "e:avatar-video->assembly", source: "avatar-video", target: "assembly" },
    ];
    await api(page, "put", `/api/v1/projects/${projectId}/canvas`, {
      expectedVersion: view.version,
      nodes,
      edges,
      viewport: view.payload.viewport,
    });

    // 4) Chat: the agent reads the canvas and proposes the run — a price card, nothing starts yet.
    await sendRealComposerMessage(page, "phase6f: собери ролик на холсте");
    const approvals = async () =>
      (await api<{ items: Array<{ status: string; targetType: string }> }>(page, "get", `/api/v1/projects/${projectId}/approvals`)).items.filter(
        (a) => a.targetType === "CANVAS_RUN",
      );
    await expect.poll(async () => (await approvals()).length, { timeout: 120_000 }).toBe(1);
    expect(Object.keys((await api<CanvasView>(page, "get", `/api/v1/projects/${projectId}/canvas`)).runs)).toHaveLength(0);
    const card = page.locator('[data-testid="approval-card"][data-approval-status="pending"]').last();
    await expect(card).toContainText("тест: $0", { timeout: 60_000 });
    await acceptanceScreenshot(page, "phase6f-chat-price-card");

    // 5) Approve in the chat → jobs run → the MP4 arrives in the chat by itself.
    await approveNextPendingViaUi(page, projectId);
    await expect.poll(async () => (await canvasDeliveries(page, cid)).length, { timeout: 300_000, intervals: [2000, 3000, 5000] }).toBe(1);
    const afterAll = await api<CanvasView>(page, "get", `/api/v1/projects/${projectId}/canvas`);
    expect(afterAll.runs["avatar-video"]?.[0]).toMatchObject({ status: "COMPLETED", mimeType: "video/mp4" });
    expect(afterAll.runs["assembly"]?.[0]).toMatchObject({ status: "COMPLETED", mimeType: "video/mp4" });
    const first = (await canvasDeliveries(page, cid))[0]!;
    expect(first.assetId).toBe(afterAll.runs["assembly"]![0]!.assetId);
    await expect(page.getByTestId("video-result-card").last()).toBeVisible({ timeout: 60_000 });
    await acceptanceScreenshot(page, "phase6f-chat-mp4");

    // 6) Redo only scene 2 through the agent: one more card, a second cut; other scenes untouched.
    const scene2 = [...afterAll.scenes].sort((a, b) => a.order - b.order)[1]!.sceneId;
    const scene3 = [...afterAll.scenes].sort((a, b) => a.order - b.order)[2]!.sceneId;
    await sendRealComposerMessage(page, "phase6f: переделай вторую сцену на холсте");
    await expect.poll(async () => (await approvals()).length, { timeout: 120_000 }).toBe(2);
    await approveNextPendingViaUi(page, projectId);
    await expect.poll(async () => (await canvasDeliveries(page, cid)).length, { timeout: 300_000, intervals: [2000, 3000, 5000] }).toBe(2);
    const redo = await api<CanvasView>(page, "get", `/api/v1/projects/${projectId}/canvas`);
    const done = (id: string) => (redo.runs[id] ?? []).filter((r) => r.status === "COMPLETED").length;
    expect(done(`scene:${scene2}:video`)).toBe(2);
    expect(done(`scene:${scene3}:video`)).toBe(1);
    expect(done("avatar-video")).toBe(1);
    expect(done("assembly")).toBe(2);

    // 7) F5: the chat still shows both cuts; the canvas shows the new version.
    await pinRealProjectOnReload(page, projectId, "chat");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("video-result-card")).toHaveCount(2, { timeout: 60_000 });
    await page.getByTestId("creative-section-canvas").click();
    await expect(page.getByTestId(`canvas-node-scene:${scene2}:video-versions`)).toHaveAttribute("data-count", "2", { timeout: 30_000 });
    await acceptanceScreenshot(page, "phase6f-canvas-after-f5");
  });
});
