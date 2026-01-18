import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  webServer: {
    command: "node scripts/start-dev.mjs",
    port: 3100,
    reuseExistingServer: false,
    env: {
      PORT: "3100",
      NEXTAUTH_URL: "http://localhost:3100",
      E2E_SECRET: process.env.E2E_SECRET || "local-e2e",
      NODE_ENV: "development",
    },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});

