import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { pinRealProjectOnReload } from "./helpers/real-studio-state";

/**
 * Phase 6D acceptance (spec §10): pick a voice, "clone" a voice (mock), create an avatar (mock), F5.
 * Mock mode only: every price card must show "тест: списание $0".
 */

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

/** 1 second of 16-bit mono silence — a valid WAV the upload sniffer accepts. */
function wavBuffer(): Buffer {
  const sampleRate = 16000;
  const data = Buffer.alloc(sampleRate * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const CONSENT_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "ascii",
);

async function openSection(page: Page, id: "voices" | "avatars" | "characters" | "chat") {
  await page.getByTestId(`creative-section-${id}`).click();
  await expect(page.getByTestId(`creative-section-${id}`)).toHaveAttribute("data-active", "true");
}

/** Quote → mock price card → confirm. */
async function confirmPrice(page: Page, testId: string) {
  await page.getByTestId(`${testId}-quote`).click();
  const offer = page.getByTestId(`${testId}-offer`);
  await expect(offer).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`${testId}-price`)).toBeVisible();
  // Test mode must say that nothing is charged.
  await expect(page.getByTestId(`${testId}-mock`)).toBeVisible();
  await page.getByTestId(`${testId}-approve`).click();
  await expect(offer).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId(`${testId}-error`)).toHaveCount(0);
}

async function fillConsent(page: Page, testId: string) {
  await page.getByTestId(`${testId}-file-input`).setInputFiles({ name: "consent.pdf", mimeType: "application/pdf", buffer: CONSENT_PDF });
  await expect(page.getByTestId(`${testId}-file-file`)).toHaveCount(1, { timeout: 90_000 });
  await page.getByTestId(`${testId}-checkbox`).check();
  await page.getByTestId(`${testId}-save`).click();
  await expect(page.getByTestId(testId)).toHaveCount(0, { timeout: 30_000 });
}

test.describe("Phase 6D voices and avatars UI", () => {
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

  test("desktop — catalog voice, mock clone, mock avatar, assign to character, F5", async ({ page }) => {
    test.setTimeout(8 * 60_000);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectId = await openRealNewProject(page);
    await expect(page.getByTestId("creative-workspace")).toBeVisible({ timeout: 120_000 });
    // The chat creates the conversation that receives approval cards.
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });

    const character = await page.request.post(`/api/v1/projects/${projectId}/characters`, { data: { name: "Ведущий E2E" } });
    expect(character.ok()).toBeTruthy();
    const characterId = ((await character.json()) as { id: string }).id;

    // Russian navigation: six groups, the voice/avatar sections live under "Персонажи".
    await expect(page.getByTestId("creative-group-cast")).toBeVisible();
    await expect(page.getByTestId("creative-section-voices")).toHaveText("Голоса");

    // 1) Catalog voice — free, READY at once.
    await openSection(page, "voices");
    await expect(page.getByTestId("voice-library")).toBeVisible();
    await page.getByTestId("voice-tab-catalog").click();
    const firstCatalog = page.locator('[data-testid^="voice-catalog-add-"]').first();
    await expect(firstCatalog).toBeVisible({ timeout: 30_000 });
    await firstCatalog.click();
    await expect(page.getByTestId("voice-list")).toBeVisible({ timeout: 30_000 });
    const libraryCard = page.locator('[data-testid^="voice-card-"]').first();
    await expect(libraryCard.locator('[data-status="READY"]')).toBeVisible();

    // 2) Clone: draft → consent → mock price → confirm → READY via SSE (no reload).
    await page.getByTestId("voice-create-open").click();
    await page.getByTestId("voice-create-mode-clone").click();
    const cloneName = `Клон E2E ${Date.now().toString(36)}`;
    await page.getByTestId("voice-create-name").fill(cloneName);
    await page.getByTestId("voice-create-samples-input").setInputFiles({ name: "sample.wav", mimeType: "audio/wav", buffer: wavBuffer() });
    await expect(page.getByTestId("voice-create-samples-file")).toHaveCount(1, { timeout: 90_000 });
    await page.getByTestId("voice-create-submit").click();
    await expect(page.getByTestId("voice-create-dialog")).toBeHidden({ timeout: 30_000 });

    const voices = (await (await page.request.get("/api/v1/voices")).json()) as { items: Array<{ id: string; name: string }> };
    const clone = voices.items.find((v) => v.name === cloneName);
    expect(clone).toBeTruthy();
    const cloneId = clone!.id;

    await fillConsent(page, `voice-consent-${cloneId}`);
    await confirmPrice(page, `voice-clone-${cloneId}`);
    await expect(page.getByTestId(`voice-status-${cloneId}`)).toHaveAttribute("data-status", "READY", { timeout: 180_000 });
    await acceptanceScreenshot(page, "phase6d-voice-clone-ready");

    // Assign the cloned voice to the character from the voice card.
    await page.getByTestId(`voice-assign-${cloneId}-select`).selectOption(characterId);
    await page.getByTestId(`voice-assign-${cloneId}-submit`).click();
    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/v1/projects/${projectId}/characters`);
        const body = (await res.json()) as { items: Array<{ id: string; voiceProfileId?: string }> };
        return body.items.find((c) => c.id === characterId)?.voiceProfileId;
      }, { timeout: 30_000 })
      .toBe(cloneId);

    // 3) Avatar: photo → draft → (consent if HeyGen) → price → confirm → READY.
    await openSection(page, "avatars");
    await expect(page.getByTestId("avatar-provider-chain")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("avatar-create-open").click();
    const avatarName = `Аватар E2E ${Date.now().toString(36)}`;
    await page.getByTestId("avatar-create-name").fill(avatarName);
    await page.getByTestId("avatar-create-photos-input").setInputFiles("e2e/fixtures/1x1.png");
    await expect(page.getByTestId("avatar-create-photos-file")).toHaveCount(1, { timeout: 120_000 });
    await page.getByTestId("avatar-create-voice").selectOption(cloneId);
    await page.getByTestId("avatar-create-submit").click();
    await expect(page.getByTestId("avatar-create-dialog")).toBeHidden({ timeout: 30_000 });

    const avatars = (await (await page.request.get("/api/v1/avatars")).json()) as {
      items: Array<{ id: string; name: string; kind: string; defaultVoiceProfileId?: string | null }>;
    };
    const avatar = avatars.items.find((a) => a.name === avatarName);
    expect(avatar).toBeTruthy();
    expect(avatar!.defaultVoiceProfileId).toBe(cloneId);
    const avatarId = avatar!.id;

    if (avatar!.kind === "PHOTO") await fillConsent(page, `avatar-consent-${avatarId}`);
    await confirmPrice(page, `avatar-train-${avatarId}`);
    await expect(page.getByTestId(`avatar-status-${avatarId}`)).toHaveAttribute("data-status", "READY", { timeout: 240_000 });
    await expect(page.getByTestId(`avatar-looks-${avatarId}`)).toBeVisible({ timeout: 30_000 });
    await acceptanceScreenshot(page, "phase6d-avatar-ready");

    // 4) Character panel picks the avatar; the voice link is already shown.
    await openSection(page, "characters");
    await page.getByTestId(`character-row-${characterId}`).click();
    await expect(page.getByTestId("character-talent-voice")).toHaveValue(cloneId, { timeout: 30_000 });
    await page.getByTestId("character-talent-avatar").selectOption(avatarId);
    await expect(page.getByTestId("character-talent-avatar")).toHaveValue(avatarId, { timeout: 30_000 });

    // 5) F5 — direct library link restores the section, talent and links persist.
    await pinRealProjectOnReload(page, projectId, "chat");
    await page.goto("/studio/library/voices", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("creative-section-voices")).toHaveAttribute("data-active", "true", { timeout: 60_000 });
    await expect(page.getByTestId(`voice-status-${cloneId}`)).toHaveAttribute("data-status", "READY", { timeout: 60_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(`voice-card-${cloneId}`)).toBeVisible({ timeout: 60_000 });
    await page.goto("/studio/library/avatars", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(`avatar-status-${avatarId}`)).toHaveAttribute("data-status", "READY", { timeout: 60_000 });

    const final = await page.request.get(`/api/v1/projects/${projectId}/characters`);
    const finalBody = (await final.json()) as { items: Array<{ id: string; voiceProfileId?: string; avatarProfileId?: string }> };
    const linked = finalBody.items.find((c) => c.id === characterId);
    expect(linked?.voiceProfileId).toBe(cloneId);
    expect(linked?.avatarProfileId).toBe(avatarId);

    // The approval cards of the confirmed operations are in the chat history too.
    await openSection(page, "chat");
    await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
    await acceptanceScreenshot(page, "phase6d-chat-after");
  });
});
