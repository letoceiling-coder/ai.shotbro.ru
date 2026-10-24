import { test, expect } from "@playwright/test";
import { loginRealUser, openRealNewProject } from "./helpers/real-login";
import { enablePhase4AgentForProject } from "./helpers/phase4-rollout";

async function approvePendingApprovals(page: import("@playwright/test").Page, max = 10) {
  for (let i = 0; i < max; i++) {
    const enabled = page.getByRole("button", { name: /^Утвердить$/, disabled: false });
    if ((await enabled.count()) === 0) break;
    await enabled.first().scrollIntoViewIfNeeded();
    await enabled.first().click();
    await page.waitForTimeout(4000);
  }
}

test.describe("Phase 4 unified agent (REAL, project-scoped)", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loginRealUser(page);
  });

  test("AgentRuntime + orchestrator through mock MP4", async ({ page }) => {
    test.setTimeout(600_000);

    const projectId = await openRealNewProject(page);
    await enablePhase4AgentForProject(page, projectId);

    const input = page.getByPlaceholder(/Сообщение сохранится|сообщение|опишите/i).first();
    await input.fill("Создай рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo");
    await page.getByRole("button", { name: /отправить|send/i }).click();

    await expect(
      page.getByText(/AgentRuntime|MOCK · Phase 4|Brief \(MOCK\)|План производства/i).first(),
    ).toBeVisible({ timeout: 120_000 });

    await approvePendingApprovals(page, 6);

    await expect(
      page.getByText(/Финальный ролик|Mock-производство|Production board|Готово: mock|mock-delivery/i).first(),
    ).toBeVisible({ timeout: 420_000 });

    await page.reload();
    await expect(page.getByText(/Brief \(MOCK\)|Финальный ролик|Утверждено|MOCK · Phase 4/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
