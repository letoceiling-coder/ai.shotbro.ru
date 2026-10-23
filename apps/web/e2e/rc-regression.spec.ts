import { expect, test } from "@playwright/test";
import { loginRealUser } from "./helpers/real-login";

const demoProjects = [
  "SHOTBRO — реклама 15 сек",
  "Аватар для бренда",
  "Мультфильм для клиента",
  "Генерация фотографий",
];

test.describe("RC visual regression", () => {
  test("DEMO four scenarios render", async ({ page }, testInfo) => {
    test.skip(!!process.env.E2E_REAL_BACKEND, "DEMO-only");
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    for (const name of demoProjects) {
      await page.getByRole("button", { name }).click();
      await expect(page.getByRole("main")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`demo-${name.replace(/[^\w]+/g, "-")}.png`),
        fullPage: true,
      });
    }
  });

  test("REAL studio shell screenshot", async ({ page }, testInfo) => {
    test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");
    await loginRealUser(page);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: testInfo.outputPath("real-studio.png"), fullPage: true });
  });
});
