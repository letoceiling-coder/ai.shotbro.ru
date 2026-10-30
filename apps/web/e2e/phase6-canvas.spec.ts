import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";

/**
 * Phase 6E acceptance (spec §10): build a scene on the canvas → mock MP4, re-run one scene.
 * Mock mode only: the price card must say "тест: списание $0".
 */

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

type CanvasView = {
  version: number;
  scenes: Array<{ sceneId: string; order: number; firstFramePrompt: string; revision: number }>;
  runs: Record<string, Array<{ status: string; assetId: string | null; mimeType: string | null }>>;
  payload: { nodes: Array<{ id: string; kind: string }> };
};

const node = (sceneId: string, role: "prompt" | "frame" | "video") => `canvas-node-scene:${sceneId}:${role}`;

async function getCanvas(page: Page, projectId: string) {
  const res = await page.request.get(`/api/v1/projects/${projectId}/canvas`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as CanvasView;
}

async function approveQuote(page: Page, expectItems: number) {
  const card = page.getByTestId("canvas-quote");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("canvas-quote-mock")).toBeVisible();
  await expect(card.locator("li")).toHaveCount(expectItems);
  await page.getByTestId("canvas-approve").click();
  await expect(card).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("canvas-error")).toHaveCount(0);
}

test.describe("Phase 6E scene canvas", () => {
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

  test("desktop — storyboard → canvas → run all (mock MP4) → re-run one scene → F5", async ({ page }) => {
    test.setTimeout(10 * 60_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectId = await openRealNewProject(page);
    await expect(page.getByTestId("creative-workspace")).toBeVisible({ timeout: 120_000 });
    // The chat creates the conversation that receives the approval cards.
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });

    // Two storyboard scenes (shotbro.ru ad campaign theme).
    for (const title of ["ShotBro: идея за минуту", "ShotBro: призыв на сайт"]) {
      const r = await page.request.post(`/api/v1/projects/${projectId}/scripts/scenes`, { data: { title } });
      expect(r.ok()).toBeTruthy();
    }
    expect((await page.request.post(`/api/v1/projects/${projectId}/storyboard/sync`, { data: {} })).ok()).toBeTruthy();

    // 1) Canvas is built from the storyboard: prompt → frame → video per scene, plus assembly/output.
    await expect(page.getByTestId("creative-group-scenes")).toBeVisible();
    await page.getByTestId("creative-section-canvas").click();
    await expect(page.getByTestId("canvas-root")).toBeVisible({ timeout: 30_000 });
    const view = await getCanvas(page, projectId);
    expect(view.scenes).toHaveLength(2);
    const [s1, s2] = [...view.scenes].sort((a, b) => a.order - b.order).map((s) => s.sceneId);
    for (const s of [s1!, s2!]) {
      await expect(page.getByTestId(node(s, "frame"))).toBeVisible();
      await expect(page.getByTestId(node(s, "video"))).toBeVisible();
    }
    await expect(page.getByTestId("canvas-node-assembly")).toBeVisible();
    await expect(page.getByTestId("canvas-node-output")).toBeVisible();

    // 2) One source of truth: editing the prompt on the canvas updates the storyboard.
    const prompt = `Неоновый логотип ShotBro на тёмном фоне ${Date.now().toString(36)}`;
    const promptBox = page.getByTestId(`${node(s1!, "prompt")}-text`);
    await promptBox.fill(prompt);
    await promptBox.blur();
    await expect
      .poll(async () => {
        const sb = (await (await page.request.get(`/api/v1/projects/${projectId}/storyboard`)).json()) as {
          payload: { scenes: Array<{ sceneId: string; firstFramePrompt?: string }> };
        };
        return sb.payload.scenes.find((s) => s.sceneId === s1)?.firstFramePrompt;
      }, { timeout: 20_000 })
      .toBe(prompt);

    // 3) A run needs its inputs: the scene video alone asks to run the first frame first.
    await page.getByTestId(`${node(s1!, "video")}-run`).click();
    await expect(page.getByTestId("canvas-error")).toContainText("Сначала запустите", { timeout: 20_000 });
    expect((await getCanvas(page, projectId)).runs[`scene:${s1}:video`] ?? []).toHaveLength(0);

    // 4) «Собрать всё»: one price card for 2 frames + 2 videos + assembly, nothing runs before approval.
    await page.getByTestId("canvas-run-all").click();
    await expect(page.getByTestId("canvas-quote")).toBeVisible({ timeout: 30_000 });
    expect(Object.keys((await getCanvas(page, projectId)).runs)).toHaveLength(0);
    await acceptanceScreenshot(page, "phase6e-canvas-quote");
    await approveQuote(page, 5);

    await expect(page.getByTestId("canvas-node-assembly")).toHaveAttribute("data-status", "COMPLETED", { timeout: 240_000 });
    await expect(page.getByTestId("canvas-node-output-preview")).toBeVisible({ timeout: 60_000 });
    const afterAll = await getCanvas(page, projectId);
    const delivery = afterAll.runs["assembly"]?.[0];
    expect(delivery?.status).toBe("COMPLETED");
    expect(delivery?.mimeType).toBe("video/mp4");
    const assetRes = await page.request.get(`/api/v1/assets/${delivery!.assetId}`);
    expect(assetRes.ok()).toBeTruthy();
    expect(((await assetRes.json()) as { mimeType: string }).mimeType).toBe("video/mp4");
    await acceptanceScreenshot(page, "phase6e-canvas-assembled");

    // 5) Re-run one scene: only that node runs; it gets a second version, the other scene keeps one.
    await page.getByTestId(`${node(s1!, "video")}-run`).click();
    await approveQuote(page, 1);
    await expect(page.getByTestId(`${node(s1!, "video")}-versions`)).toHaveAttribute("data-count", "2", { timeout: 180_000 });
    await expect(page.getByTestId(node(s1!, "video"))).toHaveAttribute("data-status", "COMPLETED");
    await expect(page.getByTestId(`${node(s2!, "video")}-versions`)).toHaveAttribute("data-count", "1");

    // 6) Server-side guard: a price approved before the prompt changed is not executed.
    const quoteRes = await page.request.post(`/api/v1/projects/${projectId}/canvas/quote`, { data: { nodeIds: [`scene:${s2}:frame`] } });
    expect(quoteRes.ok()).toBeTruthy();
    const q = (await quoteRes.json()) as { approvalId: string; targetVersion: string; payloadHash: string };
    const sb2 = (await getCanvas(page, projectId)).scenes.find((s) => s.sceneId === s2)!;
    const patch = await page.request.patch(`/api/v1/projects/${projectId}/storyboard/scenes/${s2}`, {
      data: { firstFramePrompt: "Изменённый промпт после расчёта цены", expectedRevision: sb2.revision },
    });
    expect(patch.ok()).toBeTruthy();
    const approve = await page.request.post(`/api/v1/approvals/${q.approvalId}/approve`, {
      data: { expectedVersion: q.targetVersion, payloadHash: q.payloadHash },
    });
    expect(approve.status()).toBe(409);
    expect(JSON.stringify(await approve.json())).toContain("approval_mismatch");
    expect((await getCanvas(page, projectId)).runs[`scene:${s2}:frame`]).toHaveLength(1);

    // 7) Autosave + F5: a user node and the selection survive a reload.
    await page.getByTestId("canvas-add-node").selectOption("upscale");
    await expect(page.locator('[data-kind="upscale"]')).toHaveCount(1);
    await expect(page.getByTestId("canvas-save-state")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
    await expect
      .poll(async () => (await getCanvas(page, projectId)).payload.nodes.filter((n) => n.kind === "upscale").length, { timeout: 20_000 })
      .toBe(1);

    await pinRealProjectOnReload(page, projectId, "canvas");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("canvas-root")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-kind="upscale"]')).toHaveCount(1);
    await expect(page.locator('.react-flow__node.selected [data-kind="upscale"]')).toHaveCount(1);
    await expect(page.getByTestId("canvas-node-assembly")).toHaveAttribute("data-status", "COMPLETED");
    await acceptanceScreenshot(page, "phase6e-canvas-after-f5");
  });
});
