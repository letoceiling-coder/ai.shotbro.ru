import { expect, type Page } from "@playwright/test";

export async function approvePendingApprovals(page: Page, max = 10) {
  for (let i = 0; i < max; i++) {
    const enabled = page.getByRole("button", { name: /^Утвердить$/, disabled: false });
    const count = await enabled.count();
    if (count === 0) break;
    const btn = page.getByRole("button", { name: /^Утвердить$/, disabled: false }).first();
    await btn.click();
    await page
      .waitForResponse(
        (r) => /\/api\/v1\/approvals\/[^/]+\/approve/.test(r.url()) && r.request().method() === "POST" && r.ok(),
        { timeout: 60_000 },
      )
      .catch(() => undefined);
    await expect
      .poll(async () => page.getByRole("button", { name: /^Утвердить$/, disabled: false }).count(), {
        timeout: 180_000,
        intervals: [500, 1000, 2000, 3000],
      })
      .toBeLessThan(count);
  }
}
