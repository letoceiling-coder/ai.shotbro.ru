import { test, expect, type BrowserContext } from "@playwright/test";
import { acceptanceScreenshot } from "./helpers/acceptance-artifacts";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { gotoStudioSection, uploadImageViaPicker } from "./helpers/phase5-creative-ui";
import { seedScriptScene, uploadTinyImage } from "./helpers/phase5-creative-seed";

const viewports = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "desktop1440", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "mobile390", width: 390, height: 844 },
] as const;

let loggedInStorage: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

async function attachRole(page: import("@playwright/test").Page, role: string) {
  await page.getByTestId("reference-role").click();
  await page.getByRole("option", { name: role }).click();
  await page.getByTestId("reference-attach-open").click();
  await uploadImageViaPicker(page);
}

test.describe("Phase 5F reference manager", () => {
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
    test(`References attach roles + F5 @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      const projectId = await openRealNewProject(page);
      await seedScriptScene(page, projectId);

      await gotoStudioSection(page, projectId, "references");
      await expect(page.getByTestId("reference-manager")).toBeVisible({ timeout: 20_000 });

      await attachRole(page, "FIRST_FRAME");
      await attachRole(page, "STYLE");
      await acceptanceScreenshot(page, `phase5-reference-picker-${vp.name}.png`);

      await expect
        .poll(async () => {
          const r = await page.request.get(`/api/v1/projects/${projectId}/references`);
          const j = (await r.json()) as { items?: Array<{ role: string }> };
          return j.items?.length ?? 0;
        }, { timeout: 30_000 })
        .toBeGreaterThanOrEqual(2);

      await page.reload({ waitUntil: "domcontentloaded" });
      await gotoStudioSection(page, projectId, "references");
      await expect(page.getByTestId("reference-list")).toContainText("FIRST_FRAME");
      await expect(page.getByTestId("reference-list")).toContainText("STYLE");
    });
  }

  test("Detach keeps asset; cross-project isolation", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const projectA = await openRealNewProject(page);
    const assetId = await uploadTinyImage(page, projectA);
    await seedScriptScene(page, projectA);

    await gotoStudioSection(page, projectA, "references");
    await page.getByTestId("reference-role").click();
    await page.getByRole("option", { name: "GENERAL" }).click();
    await page.getByTestId("reference-attach-open").click();
    await page.getByTestId(`asset-pick-${assetId}`).click();

    const links = (await (await page.request.get(`/api/v1/projects/${projectA}/references`)).json()) as {
      items: Array<{ id: string }>;
    };
    const linkId = links.items[0]!.id;
    await page.getByTestId(`reference-detach-${linkId}`).click();

    const assetsAfter = await page.request.get(`/api/v1/projects/${projectA}/assets`);
    expect(assetsAfter.ok()).toBeTruthy();
    const list = (await assetsAfter.json()) as Array<{ id: string }>;
    expect(list.some((a) => a.id === assetId)).toBe(true);

    const createB = await page.request.post("/api/v1/projects", { data: { title: `E2E iso B ${Date.now()}` } });
    expect(createB.ok()).toBeTruthy();
    const projectB = ((await createB.json()) as { id: string }).id;
    const refsB = await page.request.get(`/api/v1/projects/${projectB}/references`);
    const jB = (await refsB.json()) as { items?: unknown[] };
    expect(jB.items?.length ?? 0).toBe(0);
  });
});
