import { expect, type Page } from "@playwright/test";

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

export async function openRealNewProject(page: Page): Promise<string> {
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  const settings = page.getByRole("button", { name: "Настройки" });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Проекты" }).click();
  }
  await settings.click();
  await page.getByRole("button", { name: "REAL" }).click();
  await page.keyboard.press("Escape");
  const createReal = page.getByRole("button", { name: "Новый проект" });
  await expect(createReal).toBeVisible({ timeout: 15_000 });
  let projectId = "";
  await Promise.all([
    page
      .waitForResponse(
        (r) => r.url().includes("/api/v1/projects") && r.request().method() === "POST" && r.ok(),
        { timeout: 45_000 },
      )
      .then(async (r) => {
        const body = (await r.json()) as { id?: string };
        if (body.id) projectId = body.id;
      }),
    createReal.click(),
  ]).catch(async () => {
    await createReal.click();
  });
  await expect(page.getByRole("heading", { name: "REAL-проект" })).toBeVisible({ timeout: 30_000 });
  if (!projectId) throw new Error("Could not capture project id from create response");
  return projectId;
}
