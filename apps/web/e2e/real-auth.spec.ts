import { expect, test } from "@playwright/test";
import path from "node:path";

test.describe("REAL mode (requires API + DB)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  async function ensureLoggedIn(page: import("@playwright/test").Page) {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (email && password) {
      await page.goto("/login");
      await page.getByPlaceholder("Email").fill(email);
      await page.getByPlaceholder("Пароль").fill(password);
      await page.getByRole("button", { name: "Войти" }).click();
      await page.waitForURL(/\/(studio)?/, { timeout: 15_000 });
      return { email, password };
    }
    if (process.env.E2E_ALLOW_REGISTER !== "1") {
      test.skip(true, "Set E2E_TEST_EMAIL/E2E_TEST_PASSWORD or E2E_ALLOW_REGISTER=1");
    }
    const regEmail = `e2e-${Date.now()}@shotbro.test`;
    const regPass = "TestPass123!";
    await page.goto("/register");
    await page.getByPlaceholder("Имя").fill("E2E User");
    await page.getByPlaceholder("Email").fill(regEmail);
    await page.getByPlaceholder("Пароль").fill(regPass);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();
    return { email: regEmail, password: regPass };
  }

  test("login create project message reload restore", async ({ page }) => {
    const creds = await ensureLoggedIn(page);

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
    await page.getByPlaceholder("Email").fill(creds.email);
    await page.getByPlaceholder("Пароль").fill(creds.password);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.goto("/studio");
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });
  });

  test("upload small png via REAL thread", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await page.getByRole("button", { name: "Новый проект" }).click();
    await expect(page.getByText("REAL-проект")).toBeVisible({ timeout: 15_000 });

    const fixture = path.join(__dirname, "fixtures", "1x1.png");
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await expect(page.getByText(/Файлов в проекте: [1-9]/)).toBeVisible({ timeout: 60_000 });
  });
});
