import { test, expect } from "@playwright/test";
import { realLogin } from "./helpers/real-login";

test.describe("Phase 3 mock production (REAL)", () => {
  test.beforeEach(async ({ page }) => {
    await realLogin(page);
  });

  test("agent run stops at plan approval after creative request", async ({ page }) => {
    await page.goto("/studio/real");
    await page.getByRole("button", { name: /новый проект|create/i }).click().catch(() => undefined);
    const title = `Phase3 E2E ${Date.now()}`;
    await page.getByPlaceholder(/название/i).fill(title);
    await page.getByRole("button", { name: /создать/i }).click();
    await page.waitForURL(/\/studio\/real\/[a-f0-9-]+/i);

    const input = page.getByPlaceholder(/сообщение|опишите/i).first();
    await input.fill("Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo");
    await page.getByRole("button", { name: /отправить|send/i }).click();

    await expect(page.getByText(/Brief \(MOCK\)|План производства/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Утвердите план/i).first()).toBeVisible({ timeout: 60_000 });
  });
});
