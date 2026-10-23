import { expect, test } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

test.describe("REAL approvals", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
  });

  test("approve persists after reload", async ({ page }) => {
    await loginRealUser(page);
    await openRealNewProject(page);
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

  test("reject and revision disable actions", async ({ page }) => {
    await loginRealUser(page);
    await openRealNewProject(page);

    const convRes = await page.request.get("/api/v1/projects?limit=5");
    const projectId = ((await convRes.json()) as { items: Array<{ id: string }> }).items[0]?.id;
    const convList = await page.request.get(`/api/v1/projects/${projectId}/conversations`);
    const conversationId = ((await convList.json()) as Array<{ id: string }>)[0]?.id;

    const rejectTitle = `E2E reject ${Date.now()}`;
    await page.request.post(`/api/v1/projects/${projectId}/approvals`, {
      data: {
        conversationId,
        title: rejectTitle,
        targetType: "artifact",
        targetId: "e2e-reject",
        targetVersion: "v1",
        payload: {},
      },
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(rejectTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Отклонить" }).click();
    await expect(page.getByText("Отклонено")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Утвердить" })).toBeDisabled();

    const revTitle = `E2E revision ${Date.now()}`;
    await page.request.post(`/api/v1/projects/${projectId}/approvals`, {
      data: {
        conversationId,
        title: revTitle,
        targetType: "artifact",
        targetId: "e2e-rev",
        targetVersion: "v1",
        payload: {},
      },
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(revTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Правки", disabled: false }).click();
    await expect(page.getByText("Нужны правки")).toBeVisible({ timeout: 15_000 });
  });
});
