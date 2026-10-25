import type { Page } from "@playwright/test";

/** Optional acceptance PNGs — set E2E_ACCEPTANCE_SHOTS=1 on release runs only. */
export async function acceptanceScreenshot(page: Page, fileName: string): Promise<void> {
  if (process.env.E2E_ACCEPTANCE_SHOTS !== "1") return;
  await page.screenshot({ path: `test-results/${fileName}`, fullPage: true });
}
