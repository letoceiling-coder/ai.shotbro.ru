import { test, expect, type BrowserContext } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

/**
 * Voice UX: listen to catalog voices, record a voice sample in the browser (fake microphone),
 * listen back, save it, and record a spoken consent. Test mode — nothing paid is started.
 */

test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["microphone"],
});

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

test.describe("Voice listening and in-browser recording", () => {
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

  test("catalog preview plays, sample recorded and saved, consent recorded", async ({ page }) => {
    test.setTimeout(6 * 60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await openRealNewProject(page);
    await expect(page.getByTestId("chat-welcome")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("chat-quick-voice")).toBeVisible();

    // Section menu: on a narrow window the mouse wheel and the arrows scroll it sideways.
    await page.setViewportSize({ width: 900, height: 900 });
    const scroller = page.getByTestId("creative-nav-scroller");
    await expect(page.getByTestId("creative-nav-right")).toBeEnabled({ timeout: 10_000 });
    await scroller.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft), { timeout: 5_000 }).toBeGreaterThan(50);
    await scroller.evaluate((el) => (el.scrollLeft = 0));
    await page.getByTestId("creative-nav-right").click();
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft), { timeout: 5_000 }).toBeGreaterThan(50);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1) Catalog: real ElevenLabs voices with a listenable preview served by our API.
    await page.getByTestId("creative-section-voices").click();
    await page.getByTestId("voice-tab-catalog").click();
    const library = (await (await page.request.get("/api/v1/voices/library")).json()) as {
      items: Array<{ providerVoiceId: string; previewUrl: string | null }>;
      mock: boolean;
    };
    const withPreview = library.items.find((v) => v.previewUrl);
    if (!library.mock) {
      expect(withPreview, "real catalog must expose previews").toBeTruthy();
      await expect(page.getByTestId(`voice-catalog-preview-${withPreview!.providerVoiceId}`)).toBeVisible({ timeout: 30_000 });
      const res = await page.request.get(withPreview!.previewUrl!);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("audio/mpeg");
      expect((await res.body()).length).toBeGreaterThan(5_000);
    }
    await acceptanceScreenshot(page, "voice-catalog-preview");

    // 2) Record a sample in the browser (fake mic), listen back, save.
    await page.getByTestId("voice-create-open").click();
    await expect(page.getByTestId("voice-create-recorder-script")).not.toBeEmpty();
    await page.getByTestId("voice-create-recorder-start").click();
    await expect(page.getByTestId("voice-create-recorder")).toHaveAttribute("data-phase", "recording", { timeout: 15_000 });
    await page.waitForTimeout(21_500);
    await page.getByTestId("voice-create-recorder-stop").click();
    await expect(page.getByTestId("voice-create-recorder-playback")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("voice-create-recorder-save").click();
    await expect(page.getByTestId("voice-create-samples-file")).toHaveCount(1, { timeout: 90_000 });
    await expect(page.getByTestId("voice-create-samples-file")).toContainText(".wav");

    const name = `Запись E2E ${Date.now().toString(36)}`;
    await page.getByTestId("voice-create-name").fill(name);
    await page.getByTestId("voice-create-submit").click();
    await expect(page.getByTestId("voice-create-dialog")).toBeHidden({ timeout: 30_000 });
    const voices = (await (await page.request.get("/api/v1/voices")).json()) as { items: Array<{ id: string; name: string; sampleAssetIds: string[] }> };
    const voice = voices.items.find((v) => v.name === name)!;
    expect(voice.sampleAssetIds).toHaveLength(1);
    const sample = (await (await page.request.get(`/api/v1/assets/${voice.sampleAssetIds[0]}`)).json()) as { mimeType: string; sizeBytes: number };
    expect(sample.mimeType).toBe("audio/wav");
    expect(sample.sizeBytes).toBeGreaterThan(20 * 24_000 * 2);

    // The draft card lets you listen to your own recording.
    await expect(page.getByTestId(`voice-sample-${voice.id}`)).toBeVisible({ timeout: 30_000 });

    // 3) Spoken consent: name → read the text → save.
    const consent = `voice-consent-${voice.id}`;
    await expect(page.getByTestId(`${consent}-how-record`)).toBeVisible();
    await page.getByTestId(`${consent}-person`).fill("Иван Тестов");
    await expect(page.getByTestId(`${consent}-recorder-script`)).toContainText("Иван Тестов");
    await page.getByTestId(`${consent}-recorder-start`).click();
    await page.waitForTimeout(6_500);
    await page.getByTestId(`${consent}-recorder-stop`).click();
    await page.getByTestId(`${consent}-recorder-save`).click();
    await expect(page.getByTestId(`${consent}-recorded`)).toBeVisible({ timeout: 90_000 });
    await page.getByTestId(`${consent}-checkbox`).check();
    await page.getByTestId(`${consent}-save`).click();
    await expect(page.getByTestId(consent)).toHaveCount(0, { timeout: 30_000 });
    // Consent stored → the paid clone step (price → confirm) is offered next.
    await expect(page.getByTestId(`voice-clone-${voice.id}-quote`)).toBeVisible({ timeout: 30_000 });
    await acceptanceScreenshot(page, "voice-recorded-consent");
  });
});
