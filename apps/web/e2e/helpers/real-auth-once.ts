import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { loginRealUser } from "./real-login";

const AUTH_FILE = path.join(process.cwd(), "e2e/.auth/real-user.json");

/** One sign-in per Playwright process (shared across viewport projects). */
export async function applyRealAuthOnce(page: Page, context: BrowserContext) {
  if (fs.existsSync(AUTH_FILE)) {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")) as Awaited<
      ReturnType<BrowserContext["storageState"]>
    >;
    if (state.cookies?.length) await context.addCookies(state.cookies);
    return;
  }
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await loginRealUser(page);
  const state = await context.storageState();
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(state));
  if (state.cookies.length) await context.addCookies(state.cookies);
}
