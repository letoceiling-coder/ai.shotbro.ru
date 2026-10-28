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
  await Promise.all([
    page.waitForURL(/\/studio/, { timeout: 60_000 }),
    submit.click(),
  ]);
  await expect
    .poll(async () => (await page.request.get("/api/v1/users/me")).ok(), {
      timeout: 30_000,
      intervals: [300, 500, 1000],
    })
    .toBe(true);
}

export async function expectRealComposerReady(page: Page) {
  await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("real-composer")).toBeVisible({ timeout: 15_000 });
  const input = page.getByTestId("real-composer-input");
  await expect(input).toBeVisible({ timeout: 15_000 });
  await expect(input).toBeEnabled({ timeout: 60_000 });
  return input;
}

export async function fillRealComposer(page: Page, message: string) {
  const input = await expectRealComposerReady(page);
  await input.click();
  await input.fill(message);
  const sendBtn = page.getByRole("button", { name: /отправить|send/i });
  await expect(sendBtn).toBeEnabled({ timeout: 45_000 });
}

/** Types in REAL composer and sends; waits for message POST. */
export async function sendRealComposerMessage(page: Page, message: string) {
  await fillRealComposer(page, message);
  const sendBtn = page.getByRole("button", { name: /отправить|send/i });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST" && r.ok(),
      { timeout: 90_000 },
    ),
    page
      .waitForResponse(
        (r) => r.url().includes("/agent/runs") && r.request().method() === "POST",
        { timeout: 90_000 },
      )
      .catch(() => null),
    sendBtn.click(),
  ]);
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
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await create.isVisible().catch(() => false)) return;
    const projects = page.getByRole("button", { name: "Проекты" });
    if (await projects.isVisible().catch(() => false)) {
      await projects.click();
    }
    const expand = page.getByRole("button", { name: "Развернуть sidebar" });
    if (await expand.isVisible().catch(() => false)) {
      await expand.click();
    }
    if (await create.isVisible().catch(() => false)) return;
    if (attempt === 0) {
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => window.localStorage.setItem("shotbro-studio-mode-v1", "REAL"));
    }
  }
  await expect(create).toBeVisible({ timeout: 30_000 });
}

/** Switches studio from DEMO to REAL via header toggle (falls back to settings on mobile). */
export async function switchToRealMode(page: Page) {
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.setItem("shotbro-studio-mode-v1", "REAL"));
  const headerReal = page.getByRole("button", { name: "REAL", exact: true });
  if (await headerReal.isVisible().catch(() => false)) {
    await headerReal.click();
  } else {
    await openStudioSettings(page);
    await page.getByRole("button", { name: "REAL", exact: true }).click();
    await page.keyboard.press("Escape");
  }
  await expect(page.getByRole("button", { name: "Открыть REAL-студию" })).toHaveCount(0, { timeout: 15_000 });
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
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("REAL-режим: создайте")).toHaveCount(0, { timeout: 15_000 });
  await expectRealComposerReady(page);
  await expect(page.getByTestId("real-thread")).toHaveAttribute("data-conversation-id", /.+/u, {
    timeout: 60_000,
  });
  const chatTab = page.getByTestId("creative-section-chat");
  if (await chatTab.isVisible().catch(() => false)) {
    await chatTab.click();
  }
  if (!projectId) throw new Error("Could not capture project id from create response");
  return projectId;
}

export async function openRealNewProject(page: Page): Promise<string> {
  await switchToRealMode(page);
  const projectTitle = `E2E ${Date.now().toString(36)}`;
  return createProjectViaDialog(page, projectTitle);
}
