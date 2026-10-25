import { test, expect, type BrowserContext } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { gotoStudioSection } from "./helpers/phase5-creative-ui";
import { seedScriptScene } from "./helpers/phase5-creative-seed";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Phase 5I timeline studio", () => {
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
    test(`Timeline sync reorder save @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      await seedScriptScene(page, projectId);

      await gotoStudioSection(page, projectId, "storyboard");
      await page.getByTestId("storyboard-sync").click();
      await expect
        .poll(async () => (await page.request.get(`/api/v1/projects/${projectId}/storyboard`)).ok(), {
          timeout: 30_000,
        })
        .toBe(true);

      await gotoStudioSection(page, projectId, "timeline");
      await expect(page.getByTestId("timeline-studio")).toBeVisible({ timeout: 20_000 });

      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/timeline/sync-from-storyboard") && r.ok(), { timeout: 60_000 }),
        page.getByTestId("timeline-sync-storyboard").click(),
      ]);

      const tl1 = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
      expect(tl1.ok()).toBeTruthy();
      const j1 = (await tl1.json()) as { payload?: { tracks?: Array<{ clips?: Array<{ clipId: string; order: number }> }> } };
      const clips = j1.payload?.tracks?.find((t) => t.clips?.length)?.clips ?? j1.payload?.tracks?.[0]?.clips ?? [];
      expect(clips.length).toBeGreaterThan(0);

      if (clips.length >= 2) {
        const first = clips.find((c) => c.order === 0)!;
        await page.getByTestId(`timeline-clip-down-${first.clipId}`).click();
        await expect
          .poll(async () => {
            const r = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
            const j = (await r.json()) as { payload?: { revision?: number } };
            return j.payload?.revision ?? 0;
          }, { timeout: 20_000 })
          .toBeGreaterThan(1);
      }

      const firstClipBtn = page.locator("[data-testid^=timeline-clip-]").first();
      await firstClipBtn.click();
      await page.getByTestId("timeline-clip-duration").fill("2500");
      await page.getByTestId("timeline-save").click();
      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
          const j = (await r.json()) as { payload?: { tracks?: Array<{ clips?: Array<{ durationMs?: number }> }> } };
          const c = j.payload?.tracks?.[0]?.clips?.[0];
          return c?.durationMs;
        }, { timeout: 20_000 })
        .toBe(2500);

      await pinRealProjectOnReload(page, projectId, "timeline");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("timeline-studio")).toBeVisible({ timeout: 20_000 });
      const after = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
      const ja = (await after.json()) as { payload?: { revision?: number } };
      expect((ja.payload?.revision ?? 0) >= 2).toBeTruthy();
    });
  }
});
