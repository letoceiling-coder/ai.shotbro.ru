import { test, expect, type Page } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

/**
 * UI audit screenshots (no assertions on business logic): what a user sees on key Phase 6 screens.
 * Writes PNGs to test-results/ui-audit/. Mock mode only — nothing is generated.
 */

const DIR = "test-results/ui-audit";

async function shot(page: Page, name: string) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`ui audit @ ${vp.name}`, async ({ page }) => {
    test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");
    test.setTimeout(6 * 60_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await loginRealUser(page);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await shot(page, `${vp.name}-00-studio-start`);
    await openRealNewProject(page);
    await expect(page.getByTestId("creative-workspace")).toBeVisible({ timeout: 120_000 });
    await shot(page, `${vp.name}-01-chat-empty`);

    const go = async (id: string, name: string) => {
      const btn = page.getByTestId(`creative-section-${id}`);
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await shot(page, `${vp.name}-${name}`);
    };
    await go("canvas", "02-canvas");
    await go("voices", "03-voices");
    await page.getByTestId("voice-create-open").click();
    await shot(page, `${vp.name}-04-voice-create-clone`);
    await page.getByTestId("voice-create-mode-design").click();
    await shot(page, `${vp.name}-05-voice-create-design`);
    await page.keyboard.press("Escape");
    await go("avatars", "06-avatars");
    await page.getByTestId("avatar-create-open").click();
    await shot(page, `${vp.name}-07-avatar-create`);
    await page.keyboard.press("Escape");
    await go("characters", "08-characters");
    await go("storyboard", "09-storyboard");
  });
}
