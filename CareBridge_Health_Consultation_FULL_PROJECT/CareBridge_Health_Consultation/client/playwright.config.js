import { defineConfig, devices } from "@playwright/test";

const dataFile = process.env.CAREBRIDGE_E2E_DATA_FILE || "";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop-firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: [
    {
      command: "node index.js",
      cwd: "../server",
      url: "http://127.0.0.1:5000/api/health",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        DATA_FILE: dataFile,
        PORT: "5000",
        LOG_LEVEL: "silent",
        NODE_ENV: "development",
      },
    },
    {
      command: "npm run preview -- --host 127.0.0.1 --port 5173 --strictPort",
      cwd: ".",
      url: "http://127.0.0.1:5173/login",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env },
    },
  ],
});
