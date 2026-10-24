import { expect, type Page } from "@playwright/test";

export async function loginRealUser(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("E2E_TEST_EMAIL/PASSWORD required");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль").fill(password);
  const submit = page.getByRole("button", { name: "Войти" });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await expect(page).toHaveURL(/\/studio/, { timeout: 60_000 });
}

export async function fillRealComposer(page: Page, message: string) {
  await expect(page.getByTestId("real-composer")).toBeVisible({ timeout: 45_000 });
  const input = page.getByPlaceholder(/Опишите задачу|Сообщение сохранится|сообщение|опишите/i).first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.click();
  await input.fill(message);
  const sendBtn = page.getByRole("button", { name: /отправить|send/i });
  await expect(sendBtn).toBeEnabled({ timeout: 45_000 });
}

/** Opens settings and switches studio from DEMO to REAL (mobile-safe). */
export async function switchToRealMode(page: Page) {
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  const settings = page.getByRole("button", { name: "Настройки" });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Проекты" }).click();
  }
  await settings.click();
  await page.getByRole("button", { name: "REAL" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Новый проект/i }).first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function openRealNewProject(page: Page): Promise<string> {
  await switchToRealMode(page);
  await page.getByRole("button", { name: /Новый проект/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  const projectTitle = `E2E ${Date.now().toString(36)}`;
  await page.getByPlaceholder("Название проекта").fill(projectTitle);
  let projectId = "";
  await Promise.all([
    page
      .waitForResponse(
        (r) => r.url().includes("/api/v1/projects") && r.request().method() === "POST" && r.ok(),
        { timeout: 60_000 },
      )
      .then(async (r) => {
        const body = (await r.json()) as { id?: string };
        if (body.id) projectId = body.id;
      }),
    page.getByRole("button", { name: "Создать" }).click(),
  ]);
  await expect(page.getByTestId("real-composer")).toBeVisible({ timeout: 60_000 });
  if (!projectId) throw new Error("Could not capture project id from create response");
  return projectId;
}
