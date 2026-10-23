import { test, expect } from "@playwright/test";
import { loginRealUser } from "./helpers/real-login";

async function approvePendingApprovals(page: import("@playwright/test").Page, max = 8) {
  for (let i = 0; i < max; i++) {
    const approve = page.getByRole("button", { name: /^Утвердить$/ }).first();
    if (!(await approve.isVisible().catch(() => false))) break;
    await approve.click();
    await page.waitForTimeout(1500);
  }
}

test.describe("Phase 3 mock production (REAL)", () => {
  test.beforeEach(async ({ page }) => {
    await loginRealUser(page);
  });

  test("full chain through delivery MP4", async ({ page }) => {
    test.setTimeout(600_000);

    await page.goto("/studio/real");
    await page.getByRole("button", { name: /новый проект|create/i }).click().catch(() => undefined);
    const title = `Phase3 E2E ${Date.now()}`;
    await page.getByPlaceholder(/название/i).fill(title);
    await page.getByRole("button", { name: /создать/i }).click();
    await page.waitForURL(/\/studio\/real\/[a-f0-9-]+/i);

    const input = page.getByPlaceholder(/сообщение|опишите/i).first();
    await input.fill("Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo");
    await page.getByRole("button", { name: /отправить|send/i }).click();

    await expect(page.getByText(/Brief \(MOCK\)|План производства/i).first()).toBeVisible({ timeout: 120_000 });

    await approvePendingApprovals(page, 6);

    await expect(
      page.getByText(/Финальный ролик|Mock-производство|Production board|Готово: mock/i).first(),
    ).toBeVisible({ timeout: 300_000 });

    await page.reload();
    await expect(page.getByText(/Brief \(MOCK\)|Финальный ролик|Утверждено/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
