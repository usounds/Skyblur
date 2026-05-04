import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function loadBaseUrlFromDotenv() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return;

  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("NEXT_PUBLIC_BASE_URL="));
  const rawValue = line?.split("=").slice(1).join("=").trim();
  if (!rawValue) return;

  process.env.NEXT_PUBLIC_BASE_URL = rawValue.replace(/^['"]|['"]$/g, "");
}

loadBaseUrlFromDotenv();

const e2ePort = process.env.E2E_PORT || "4501";
const e2eBaseURL = process.env.E2E_BASE_URL || `http://localhost:${e2ePort}`;
const e2eWebServerOutput = process.env.E2E_WEB_SERVER_LOGS === "true" ? "pipe" : "ignore";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: e2eBaseURL,
    trace: "on-first-retry",
    serviceWorkers: "block",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `rtk pnpm exec next dev --webpack -p ${e2ePort}`,
        env: {
          E2E_TEST: "true",
          E2E_COVERAGE: process.env.E2E_COVERAGE || "false",
        },
        url: e2eBaseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: e2eWebServerOutput,
        stderr: e2eWebServerOutput,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
