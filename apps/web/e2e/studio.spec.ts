import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("SHOTBRO Studio DEMO", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await page.evaluate(() => localStorage.removeItem("shotbro-studio-demo-v1"));
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("shows demo ad conversation by default", async ({ page }) => {
    await expect(page.getByText("План генерации")).toBeVisible();
    await expect(page.getByRole("button", { name: "Утвердить сценарий" })).toBeVisible();
  });

  test("approving script advances demo ad scenario", async ({ page }) => {
    const approve = page.getByRole("button", { name: "Утвердить сценарий" });
    await approve.scrollIntoViewIfNeeded();
    await approve.click();
    await expect(page.getByText("Первый кадр (DEMO)")).toBeVisible({ timeout: 15_000 });
  });

  test("theme toggle in settings", async ({ page, viewport }) => {
    if ((viewport?.width ?? 1920) < 768) {
      await page.getByRole("button", { name: "Проекты" }).click();
    }
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "Светлая" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
  });
});
