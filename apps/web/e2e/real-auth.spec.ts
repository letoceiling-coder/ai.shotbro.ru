import { expect, test } from "@playwright/test";

test.describe("REAL mode (requires API + DB)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1 with api/postgres running");

  test("login create project message reload restore", async ({ page }) => {
    const email = `e2e-${Date.now()}@shotbro.test`;
    const password = "TestPass123!";
    const projectTitle = `E2E ${Date.now()}`;

    await page.goto("/register");
    await page.getByPlaceholder("Имя").fill("E2E User");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Пароль").fill(password);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();

    await page.goto("/studio");
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();

    await page.getByRole("button", { name: "Новый проект" }).click();
    await expect(page.getByText("REAL-проект")).toBeVisible({ timeout: 15_000 });

    const msg = `persist-${Date.now()}`;
    await page.getByPlaceholder("Сообщение сохранится на сервере…").fill(msg);
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });

    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Пароль").fill(password);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.goto("/studio");
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });
  });
});
