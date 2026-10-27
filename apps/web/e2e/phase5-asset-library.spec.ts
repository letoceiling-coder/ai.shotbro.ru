import { test, expect, type BrowserContext } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { gotoStudioSection, uploadImageViaPicker } from "./helpers/phase5-creative-ui";
import { seedScriptScene, tinyPngBuffer } from "./helpers/phase5-creative-seed";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

/** Minimal valid MP4 (ftyp + empty mdat) for upload MIME validation */
function tinyMp4Buffer() {
  return Buffer.from(
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZGF0YQAAAAA=",
    "base64",
  );
}

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

async function uploadViaLibraryDrop(
  page: import("@playwright/test").Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  const b64 = file.buffer.toString("base64");
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/v1/uploads/init") && r.request().method() === "POST" && r.ok(),
      { timeout: 60_000 },
    ),
    page.getByTestId("asset-library").evaluate(
      (el, payload) => {
        const bin = Uint8Array.from(atob(payload.b64), (c) => c.charCodeAt(0));
        const f = new File([bin], payload.name, { type: payload.mimeType });
        const dt = new DataTransfer();
        dt.items.add(f);
        el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      },
      { name: file.name, mimeType: file.mimeType, b64 },
    ),
  ]);
  await page.waitForResponse(
    (r) => r.url().includes("/api/v1/uploads/") && r.url().includes("/complete") && r.ok(),
    { timeout: 120_000 },
  );
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

      await uploadViaLibraryDrop(page, {
        name: "e2e-library.png",
        mimeType: "image/png",
        buffer: tinyPngBuffer(),
      });

      await expect
        .poll(async () => {
          const r = await page.request.get(
            `/api/v1/projects/${projectId}/assets?limit=24&q=e2e-library`,
          );
          if (!r.ok()) return false;
          const j = (await r.json()) as { items?: Array<{ status: string; originalName: string }> };
          return (j.items ?? []).some((a) => a.originalName === "e2e-library.png" && a.status === "READY");
        }, { timeout: 180_000 })
        .toBe(true);

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

      await gotoStudioSection(page, projectId, "storyboard");
      await page.getByTestId(/storyboard-scene-/).first().click();
      await page.getByTestId("storyboard-first-frame").getByRole("button", { name: "Назначить" }).click();
      await uploadImageViaPicker(page);

      await gotoStudioSection(page, projectId, "assets");
      await uploadViaLibraryDrop(page, {
        name: "e2e-clip.mp4",
        mimeType: "video/mp4",
        buffer: tinyMp4Buffer(),
      });

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/assets?limit=24&q=e2e-clip`);
          if (!r.ok()) return false;
          const j = (await r.json()) as { items?: Array<{ status: string; originalName: string }> };
          return (j.items ?? []).some((a) => a.originalName === "e2e-clip.mp4" && a.status === "READY");
        }, { timeout: 180_000 })
        .toBe(true);
      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "assets");

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
      await page.getByTestId("timeline-save").click();
      await expect(page.getByTestId("timeline-studio")).toBeVisible();

      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "assets");
      await expect(page.getByText("e2e-library.png")).toBeVisible({ timeout: 30_000 });

      await acceptanceScreenshot(page, `phase5-asset-library-${vp.name}.png`);
    });
  }

  test("cross-project asset download denied", async ({ page, browser }) => {
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
    await expect
      .poll(async () => {
        const r = await page.request.get(`/api/v1/projects/${projectA}/assets?limit=5&q=idor`);
        if (!r.ok()) return false;
        const j = (await r.json()) as { items?: Array<{ status: string; originalName: string }> };
        return (j.items ?? []).some((a) => a.originalName === "idor.png" && a.status === "READY");
      }, { timeout: 180_000 })
      .toBe(true);

    const listRes = await page.request.get(`/api/v1/projects/${projectA}/assets?limit=5`);
    const list = (await listRes.json()) as { items?: Array<{ id: string }> };
    const assetId = list.items?.[0]?.id;
    expect(assetId).toBeTruthy();

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto("/login", { waitUntil: "domcontentloaded" });
    await pageB.getByPlaceholder("Email").fill(emailB!);
    await pageB.getByPlaceholder("Пароль").fill(passwordB!);
    await Promise.all([
      pageB.waitForURL(/\/studio/, { timeout: 60_000 }),
      pageB.getByRole("button", { name: "Войти" }).click(),
    ]);
    const deny = await pageB.request.get(`/api/v1/assets/${assetId}/download-url`);
    expect(deny.status()).toBeGreaterThanOrEqual(400);
    await ctxB.close();
  });
});
