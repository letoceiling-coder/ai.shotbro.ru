import fs from "node:fs";
import path from "node:path";
import { test, expect, type BrowserContext } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { gotoStudioSection, uploadImageViaPicker } from "./helpers/phase5-creative-ui";
import { seedScriptScene, tinyPngBuffer } from "./helpers/phase5-creative-seed";
import {
  pollAssetReady,
  uploadViaLibraryFilePicker,
  uploadViaLibraryDrop,
} from "./helpers/asset-library-upload";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

/** ffprobe-validated on VPS: h264/yuv420p, 5s, no audio. */
function demoMp4UploadFile() {
  const demoPath = path.join(process.cwd(), "public/demo-assets/shotbro-demo.mp4");
  return {
    name: "e2e-clip.mp4",
    mimeType: "video/mp4",
    buffer: fs.readFileSync(demoPath),
  };
}

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

async function expectTimelineClipUsesAsset(page: Page, projectId: string, assetId: string) {
  const tl = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
  expect(tl.ok()).toBeTruthy();
  const body = (await tl.json()) as {
    payload?: {
      revision?: number;
      tracks?: Array<{ clips?: Array<{ assetId?: string; clipId?: string }> }>;
    };
  };
  const clips = body.payload?.tracks?.flatMap((t) => t.clips ?? []) ?? [];
  expect(clips.some((c) => c.assetId === assetId)).toBe(true);
  expect(typeof body.payload?.revision).toBe("number");
}

test.describe("Phase 5J asset library", () => {
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

  for (const vp of viewports) {
    test(`REAL asset library UI @ ${vp.name}`, async ({ page }) => {
      if (vp.name === "desktop1920") test.setTimeout(360_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      await seedScriptScene(page, projectId);

      await gotoStudioSection(page, projectId, "assets");
      await expect(page.getByTestId("asset-library")).toBeVisible({ timeout: 20_000 });

      if (vp.name !== "desktop1920") {
        await acceptanceScreenshot(page, `phase5-asset-library-${vp.name}.png`);
        return;
      }

      await test.step("Upload via «Загрузить» (file picker)", async () => {
        await uploadViaLibraryFilePicker(page, {
          name: "e2e-button.png",
          mimeType: "image/png",
          buffer: tinyPngBuffer(),
        });
      });
      await pollAssetReady(page, projectId, "e2e-button.png", "e2e-button", 120_000);

      await test.step("Upload via drag-and-drop", async () => {
        await uploadViaLibraryDrop(page, {
          name: "e2e-library.png",
          mimeType: "image/png",
          buffer: tinyPngBuffer(),
        });
      });
      await pollAssetReady(page, projectId, "e2e-library.png", "e2e-library", 120_000);

      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "assets");
      await expect(page.getByTestId(/asset-card-/).first()).toBeVisible({ timeout: 30_000 });

      await page.getByTestId("asset-library-search").fill("e2e-library");
      await expect(page.getByText("e2e-library.png")).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("asset-library-filter").click();
      await page.getByRole("option", { name: "Изображения" }).click();
      await expect(page.getByTestId(/asset-card-/).first()).toBeVisible();

      const card = page.getByTestId(/asset-card-/).first();
      await card.click();
      await expect(page.getByTestId("asset-detail-sheet")).toBeVisible();
      await page.getByTestId("asset-download").click();

      await page.getByTestId("asset-add-style-reference").click();
      await gotoStudioSection(page, projectId, "references");
      await expect(page.getByTestId("reference-list")).toContainText("STYLE", { timeout: 20_000 });

      await gotoStudioSection(page, projectId, "assets");
      await page.getByTestId("asset-library-search").fill("e2e-library");
      await page.getByTestId(/asset-card-/).first().click();
      await page.getByTestId("asset-use-first-frame").click();
      await page.getByTestId("asset-use-last-frame").click();
      await page.keyboard.press("Escape");

      await gotoStudioSection(page, projectId, "storyboard");
      await expect(page.getByTestId("storyboard-scene-grid")).toBeVisible({ timeout: 30_000 });
      await page
        .getByTestId("storyboard-scene-grid")
        .locator("button[data-testid^='storyboard-scene-']")
        .first()
        .click();
      await expect(page.getByTestId("storyboard-scene-detail")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("storyboard-first-frame").getByRole("button", { name: "Назначить" }).click();
      await uploadImageViaPicker(page);

      await gotoStudioSection(page, projectId, "assets");
      await uploadViaLibraryDrop(page, demoMp4UploadFile());
      const clipAssetId = await pollAssetReady(page, projectId, "e2e-clip.mp4", "e2e-clip", 180_000);

      await gotoStudioSection(page, projectId, "timeline");
      await page.getByTestId("timeline-sync-storyboard").click();
      await expect(page.getByTestId("timeline-studio")).toBeVisible({ timeout: 60_000 });

      await gotoStudioSection(page, projectId, "assets");
      await page.getByTestId("asset-library-search").fill("e2e-clip");
      await page
        .getByTestId(/asset-card-/)
        .filter({ hasText: "e2e-clip.mp4" })
        .first()
        .click();
      await expect(page.getByTestId("asset-detail-sheet")).toBeVisible();
      await page.getByTestId("asset-add-to-timeline").click();
      await expect(page.getByTestId("timeline-pending-asset-hint")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("timeline-save")).toBeEnabled({ timeout: 20_000 });
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/api/v1/projects/${projectId}/timeline`) &&
            r.request().method() === "PATCH" &&
            r.ok(),
          { timeout: 60_000 },
        ),
        page.getByTestId("timeline-save").click(),
      ]);
      await expect(page.getByTestId("timeline-studio")).toBeVisible();
      await expectTimelineClipUsesAsset(page, projectId, clipAssetId);

      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "timeline");
      await expectTimelineClipUsesAsset(page, projectId, clipAssetId);

      await gotoStudioSection(page, projectId, "assets");
      await expect(page.getByText("e2e-library.png")).toBeVisible({ timeout: 30_000 });

      await acceptanceScreenshot(page, `phase5-asset-library-${vp.name}.png`);
    });
  }

  test("native file picker upload only (no DnD)", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectId = await openRealNewProject(page);
    await gotoStudioSection(page, projectId, "assets");
    await uploadViaLibraryFilePicker(page, {
      name: "e2e-picker.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    await pollAssetReady(page, projectId, "e2e-picker.png", "e2e-picker", 120_000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await gotoStudioSection(page, projectId, "assets");
    await expect(page.getByText("e2e-picker.png")).toBeVisible({ timeout: 30_000 });
  });

  test("cross-project asset access denied (user B)", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const emailB = process.env.E2E_TEST_EMAIL_B;
    const passwordB = process.env.E2E_TEST_PASSWORD_B;
    test.skip(!emailB || !passwordB, "Set E2E_TEST_EMAIL_B / E2E_TEST_PASSWORD_B");

    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectA = await openRealNewProject(page);
    await gotoStudioSection(page, projectA, "assets");
    await uploadViaLibraryDrop(page, {
      name: "idor.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    const assetId = await pollAssetReady(page, projectA, "idor.png", "idor", 180_000);

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto("/login", { waitUntil: "domcontentloaded" });
    await pageB.getByPlaceholder("Email").fill(emailB!);
    await pageB.getByPlaceholder("Пароль").fill(passwordB!);
    await Promise.all([
      pageB.waitForURL(/\/studio/, { timeout: 60_000 }),
      pageB.getByRole("button", { name: "Войти" }).click(),
    ]);

    const deny = (status: number) => expect(status).toBeGreaterThanOrEqual(400);

    deny((await pageB.request.get(`/api/v1/projects/${projectA}/assets?limit=5`)).status());
    deny((await pageB.request.get(`/api/v1/assets/${assetId}`)).status());
    deny((await pageB.request.get(`/api/v1/assets/${assetId}/preview-url`)).status());
    deny((await pageB.request.get(`/api/v1/assets/${assetId}/download-url`)).status());
    deny(
      (
        await pageB.request.patch(`/api/v1/assets/${assetId}`, {
          data: { originalName: "hacked.png" },
        })
      ).status(),
    );
    deny((await pageB.request.post(`/api/v1/assets/${assetId}/delete`, { data: {} })).status());

    await ctxB.close();
  });
});
