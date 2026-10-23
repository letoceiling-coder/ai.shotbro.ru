import { expect, test } from "@playwright/test";

test.describe("REAL approvals", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
  });

  test("approve persists after reload", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD required");

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Пароль").fill(password!);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForURL("**/studio**", { timeout: 45_000 });

    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Новый проект" }).click();
    await expect(page.getByRole("heading", { name: "REAL-проект" })).toBeVisible();

    const convRes = await page.request.get("/api/v1/projects?limit=5");
    const projects = (await convRes.json()) as { items: Array<{ id: string }> };
    const projectId = projects.items[0]?.id;
    expect(projectId).toBeTruthy();

    const convList = await page.request.get(`/api/v1/projects/${projectId}/conversations`);
    const convs = (await convList.json()) as Array<{ id: string }>;
    const conversationId = convs[0]?.id;
    expect(conversationId).toBeTruthy();

    const title = `E2E approval ${Date.now()}`;
    await page.request.post(`/api/v1/projects/${projectId}/approvals`, {
      data: {
        conversationId,
        title,
        targetType: "artifact",
        targetId: "e2e-artifact",
        targetVersion: "v1",
        payload: { e2e: true },
      },
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Утвердить" }).click();
    await expect(page.getByText("Утверждено")).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Утверждено")).toBeVisible({ timeout: 15_000 });
  });
});
