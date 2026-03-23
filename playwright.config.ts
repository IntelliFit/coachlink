import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3001);
const host = process.env.PLAYWRIGHT_HOST || "127.0.0.1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  webServer: {
    command: "node scripts/start-dev.mjs",
    port,
    // In local dev it’s common to already have `next dev` running; reuse it to avoid `.next/dev/lock` failures.
    reuseExistingServer: true,
    env: {
      PORT: String(port),
      // Use IPv4 loopback explicitly to avoid Windows resolving `localhost` to `::1` and causing connection issues.
      NEXTAUTH_URL: baseURL,
      E2E_SECRET: process.env.E2E_SECRET || "local-e2e",
      NODE_ENV: "development",
    },
  },
  use: {
    baseURL,
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

