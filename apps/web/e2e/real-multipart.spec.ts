import { execSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";

test.describe("REAL multipart upload", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeAll(() => {
    execSync("node ./e2e/fixtures/generate-large-upload.mjs", { cwd: join(__dirname, "..") });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
  });

  test("browser uploads >8MB file and asset becomes READY", async ({ page }) => {
    await loginRealUser(page);
    await openRealNewProject(page);
    await expect(page.getByRole("heading", { name: "REAL-проект" })).toBeVisible();
    await expect(page.getByTestId("real-sse-status")).toContainText("подключено", { timeout: 20_000 });

    const filePath = join(__dirname, "fixtures", "large-e2e.pdf");
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await expect(page.getByText(/Загрузка:/)).toBeVisible({ timeout: 15_000 });

    const projects = await page.request.get("/api/v1/projects?limit=5");
    const projectId = ((await projects.json()) as { items: Array<{ id: string }> }).items[0]?.id;
    expect(projectId).toBeTruthy();

    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/v1/projects/${projectId}/assets`);
          const list = (await res.json()) as Array<{ status: string; originalName?: string }>;
          return list.find((a) => a.originalName === "large-e2e.pdf")?.status ?? "MISSING";
        },
        { timeout: 120_000, intervals: [2000, 3000, 5000] },
      )
      .toBe("READY");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "REAL" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/файлов: \d+/)).toBeVisible({ timeout: 15_000 });
  });
});
