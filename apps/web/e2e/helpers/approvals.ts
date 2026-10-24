import { expect, type Page } from "@playwright/test";

export async function approvePendingApprovals(page: Page, max = 10) {
  for (let i = 0; i < max; i++) {
    const enabled = page.getByRole("button", { name: /^Утвердить$/, disabled: false });
    const count = await enabled.count();
    if (count === 0) break;
    await enabled.first().scrollIntoViewIfNeeded();
    await Promise.all([
      page
        .waitForResponse(
          (r) => r.url().includes("/api/v1/approvals/") && r.request().method() === "POST" && r.ok(),
          { timeout: 60_000 },
        )
        .catch(() => null),
      enabled.first().click(),
    ]);
    await expect
      .poll(async () => page.getByRole("button", { name: /^Утвердить$/, disabled: false }).count())
      .toBeLessThan(count);
  }
}
