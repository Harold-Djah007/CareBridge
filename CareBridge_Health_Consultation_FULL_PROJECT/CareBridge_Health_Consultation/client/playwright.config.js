import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (!process.env.CAREBRIDGE_E2E_DATA_FILE) {
  const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "carebridge-browser-"));
  const fixture = path.join(fixtureDirectory, "db.json");
  fs.copyFileSync(new URL("../server/tests/fixtures/demo.json", import.meta.url), fixture);
  process.env.CAREBRIDGE_E2E_DATA_FILE = fixture;
  process.env.CAREBRIDGE_E2E_TEMP_DIRECTORY = fixtureDirectory;
}
const dataFile = process.env.CAREBRIDGE_E2E_DATA_FILE;

export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/cleanup-fixture.js",
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
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
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
      reuseExistingServer: false,
      env: {
        ...process.env,
        DATA_FILE: dataFile,
        PORT: "5000",
        LOG_LEVEL: "silent",
        NODE_ENV: "development",
        // These tests deliberately simulate separate clients using forwarded IPs.
        CAREBRIDGE_BEHIND_TLS_PROXY: "true",
      },
    },
    {
      command: "npm run preview -- --host 127.0.0.1 --port 5173 --strictPort",
      cwd: ".",
      url: "http://127.0.0.1:5173/login",
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...process.env },
    },
  ],
});
