import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT || "4501";
const e2eBaseURL = process.env.E2E_BASE_URL || `http://localhost:${e2ePort}`;

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
      },
  projects: [
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
