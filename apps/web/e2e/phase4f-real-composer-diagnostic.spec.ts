import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  ensureRealCreateVisible,
  expectRealComposerReady,
  loginRealUser,
  switchToRealMode,
} from "./helpers/real-login";

const OUT = process.env.E2E_DIAG_DIR ?? "/tmp/phase4f-composer-diag";

function log(line: string) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.appendFileSync(path.join(OUT, "trace.log"), `${new Date().toISOString()} ${line}\n`);
}

test.describe("Phase 4F REAL composer diagnostic", () => {
  test.skip(!process.env.E2E_REAL_BACKEND, "Set E2E_REAL_BACKEND=1");

  test("desktop: login → REAL → new project → composer", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "trace.log"), "");

    const projectTitle = `DIAG ${Date.now().toString(36)}`;
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 500));
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message).slice(0, 500)));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    log(`STEP login url=${page.url()}`);
    await loginRealUser(page);
    log(`STEP after login url=${page.url()}`);

    await switchToRealMode(page);
    log(`STEP REAL mode url=${page.url()} demoBanner=${await page.getByText("локальные сценарии без сервера").count()}`);

    await ensureRealCreateVisible(page);
    await page.getByTestId("real-new-project-btn").click();
    log("STEP dialog open");
    await expect(page.getByTestId("new-project-dialog")).toBeVisible();
    await page.screenshot({ path: path.join(OUT, "01-dialog.png"), fullPage: true });

    await page.getByPlaceholder("Название проекта").fill(projectTitle);
    let projectId = "";
    const failedRequests: string[] = [];
    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText ?? ""}`.slice(0, 300));
    });

    await Promise.all([
      page
        .waitForResponse(
          (r) => r.url().includes("/api/v1/projects") && r.request().method() === "POST" && r.ok(),
          { timeout: 60_000 },
        )
        .then(async (r) => {
          const body = (await r.json()) as { id?: string };
          projectId = body.id ?? "";
          log(`STEP create response projectId=${projectId}`);
        }),
      page.getByRole("button", { name: "Создать" }).click(),
    ]);

    await expect(page.getByTestId("new-project-dialog")).toBeHidden({ timeout: 15_000 });
    log(`STEP dialog closed url=${page.url()} projectId=${projectId}`);

    const emptyReal = await page.getByText("REAL-режим: создайте").count();
    log(`STEP emptyRealBanner count=${emptyReal}`);

    const threadVisible = await page.getByTestId("real-thread").isVisible().catch(() => false);
    const composerVisible = await page.getByTestId("real-composer").isVisible().catch(() => false);
    log(`STEP thread=${threadVisible} composer=${composerVisible}`);

    if (projectId) {
      const convRes = await page.request.get(`/api/v1/projects/${projectId}/conversations`);
      log(`STEP conversations status=${convRes.status()} bodyLen=${(await convRes.text()).slice(0, 200)}`);
    }

    await page.screenshot({ path: path.join(OUT, "02-after-create.png"), fullPage: true });

    const composerBox = await page.getByTestId("real-composer").boundingBox().catch(() => null);
    log(`STEP composer box=${JSON.stringify(composerBox)}`);

    await expectRealComposerReady(page);
    const input = page.getByTestId("real-composer-input");
    await input.fill("диагностика composer");
    await expect(page.getByRole("button", { name: /отправить|send/i })).toBeEnabled({ timeout: 30_000 });

    await page.screenshot({ path: path.join(OUT, "03-composer-ready.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "console-errors.json"), JSON.stringify(consoleErrors, null, 2));
    fs.writeFileSync(path.join(OUT, "failed-requests.json"), JSON.stringify(failedRequests, null, 2));
    fs.writeFileSync(
      path.join(OUT, "summary.json"),
      JSON.stringify({ projectId, projectTitle, url: page.url(), consoleErrors, failedRequests }, null, 2),
    );

    await testInfo.attach("diag-log", { path: path.join(OUT, "trace.log"), contentType: "text/plain" });
  });
});
