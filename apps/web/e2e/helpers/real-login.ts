import type { Page } from "@playwright/test";

export async function loginRealUser(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("E2E_TEST_EMAIL/PASSWORD required");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/studio**", { timeout: 45_000 });
}

export async function openRealNewProject(page: Page) {
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  const settings = page.getByRole("button", { name: "Настройки" });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Проекты" }).click();
  }
  await settings.click();
  await page.getByRole("button", { name: "REAL" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Новый проект" }).click();
}
