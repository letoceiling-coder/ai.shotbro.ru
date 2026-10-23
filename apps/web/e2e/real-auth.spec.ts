import { expect, test } from "@playwright/test";

test.describe("REAL mode (requires API + DB)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1 with api/postgres running");

  test("register login and create project", async ({ page }) => {
    const email = `e2e-${Date.now()}@shotbro.test`;
    await page.goto("/register");
    await page.getByPlaceholder("Имя").fill("E2E User");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Пароль").fill("TestPass123!");
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    await page.goto("/studio");
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await expect(page.getByText("REAL-проект").or(page.getByText("Новый REAL-проект"))).toBeVisible({ timeout: 15_000 });
  });
});
