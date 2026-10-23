import { defineConfig, devices } from "@playwright/test";

const stagingBase = process.env.E2E_STAGING_URL;
const realBackend = process.env.E2E_REAL_BACKEND === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: realBackend ? 120_000 : 30_000,
  fullyParallel: !realBackend,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: realBackend ? 1 : undefined,
  outputDir: "test-results",
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: stagingBase ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: realBackend ? 60_000 : 30_000,
    actionTimeout: realBackend ? 45_000 : 15_000,
    ...(realBackend && stagingBase
      ? {
          // headless_shell can hang on Windows waiting for full "load" on remote Next.js
          launchOptions: { channel: "chrome" },
        }
      : {}),
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
  webServer: realBackend && stagingBase
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        cwd: __dirname,
      },
});
