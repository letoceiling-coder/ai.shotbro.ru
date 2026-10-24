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
  await expect(page.getByPlaceholder(/Опишите задачу|Сообщение сохранится|сообщение|опишите/i).first()).toBeVisible({
    timeout: 45_000,
  });
  const input = page.getByPlaceholder(/Опишите задачу|Сообщение сохранится|сообщение|опишите/i).first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.click();
  await input.fill(message);
  const sendBtn = page.getByRole("button", { name: /отправить|send/i });
  await expect(sendBtn).toBeEnabled({ timeout: 45_000 });
}

function realProjectsSidebar(page: Page) {
  return page.getByRole("complementary").filter({ hasText: "SHOTBRO" });
}

function realCreateProjectButton(page: Page) {
  const sidebar = realProjectsSidebar(page);
  return sidebar
    .getByTestId("real-new-project-btn")
    .or(sidebar.getByRole("button", { name: "Создать проект", exact: true }))
    .or(sidebar.getByRole("button", { name: "Новый проект", exact: true }));
}

async function openStudioSettings(page: Page) {
  const settings = page.getByRole("button", { name: "Настройки", exact: true });
  if (!(await settings.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Проекты" }).click();
  }
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
}

/** Ensures REAL sidebar create control is visible (mobile sheet / collapsed sidebar). */
export async function ensureRealCreateVisible(page: Page) {
  const create = realCreateProjectButton(page);
  if (await create.isVisible().catch(() => false)) return;
  const projects = page.getByRole("button", { name: "Проекты" });
  if (await projects.isVisible().catch(() => false)) {
    await projects.click();
  }
  const expand = page.getByRole("button", { name: "Развернуть sidebar" });
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  await expect(create).toBeVisible({ timeout: 20_000 });
}

/** Opens settings and switches studio from DEMO to REAL (mobile-safe). */
export async function switchToRealMode(page: Page) {
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await openStudioSettings(page);
  await page.getByRole("button", { name: "REAL", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("локальные сценарии без сервера")).toHaveCount(0, { timeout: 15_000 });
  await ensureRealCreateVisible(page);
}

async function createProjectViaDialog(page: Page, projectTitle: string): Promise<string> {
  await realCreateProjectButton(page).scrollIntoViewIfNeeded();
  await realCreateProjectButton(page).click();
  const dialog = page.getByTestId("new-project-dialog").or(page.getByRole("dialog", { name: "Новый проект" }));
  await expect(dialog).toBeVisible({ timeout: 8_000 });
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
  await expect(page.getByPlaceholder(/Опишите задачу/i).first()).toBeVisible({ timeout: 60_000 });
  if (!projectId) throw new Error("Could not capture project id from create response");
  return projectId;
}

async function createProjectViaApi(page: Page, projectTitle: string): Promise<string> {
  const res = await page.request.post("/api/v1/projects", {
    data: {
      title: projectTitle,
      settings: { qualityStrategy: "balance", productionTemplateId: "general" },
    },
  });
  if (!res.ok()) {
    throw new Error(`POST /api/v1/projects failed: ${res.status()} ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { id: string };
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await switchToRealMode(page);
  const projectBtn = realProjectsSidebar(page).getByRole("button", { name: projectTitle, exact: true });
  await expect(projectBtn).toBeVisible({ timeout: 45_000 });
  await projectBtn.click();
  await expect(page.getByText("REAL-режим: создайте")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByPlaceholder(/Опишите задачу/i).first()).toBeVisible({ timeout: 60_000 });
  return body.id;
}

export async function openRealNewProject(page: Page): Promise<string> {
  await switchToRealMode(page);
  const projectTitle = `E2E ${Date.now().toString(36)}`;
  try {
    return await createProjectViaDialog(page, projectTitle);
  } catch {
    return createProjectViaApi(page, projectTitle);
  }
}
