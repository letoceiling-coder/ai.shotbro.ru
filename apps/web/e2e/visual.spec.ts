import { expect, test } from "@playwright/test";
import path from "node:path";

const shots = path.join(__dirname, "screenshots");

test.describe("Visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
    await page.evaluate(() => localStorage.removeItem("shotbro-studio-demo-v1"));
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("desktop studio thread", async ({ page }) => {
    await expect(page.getByText("DEMO-режим")).toBeVisible();
    await page.screenshot({ path: path.join(shots, "desktop-dialog.png"), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("approval card visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Утвердить сценарий" })).toBeVisible();
    await page.locator("text=Согласование сценария").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, "approval-card.png") });
  });

  test("mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(shots, "mobile-studio.png"), fullPage: true });
  });

  test("light theme", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByRole("button", { name: "Светлая" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.screenshot({ path: path.join(shots, "light-theme.png"), fullPage: true });
  });
});

test("video result after approval flow", async ({ page }) => {
  await page.goto("/studio");
  await page.evaluate(() => localStorage.removeItem("shotbro-studio-demo-v1"));
  await page.reload();
  await page.getByRole("button", { name: "Утвердить сценарий" }).click();
  await page.getByRole("button", { name: "Утвердить кадр" }).click();
  await expect(page.getByText("Рекламный ролик SHOTBRO")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(shots, "video-result.png"), fullPage: false });
});

test("empty hero new project", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/studio");
  await page.evaluate(() => localStorage.removeItem("shotbro-studio-demo-v1"));
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByRole("heading", { name: "Что создадим сегодня?" })).toBeVisible();
  await page.screenshot({ path: path.join(shots, "desktop-empty.png"), fullPage: true });
});
