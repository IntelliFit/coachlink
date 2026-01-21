import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  webServer: {
    command: "node scripts/start-dev.mjs",
    // Default to Next.js’ default dev port to make `reuseExistingServer` actually effective
    // when a developer already has `npm run dev` running.
    port: 3000,
    // In local dev it’s common to already have `next dev` running; reuse it to avoid `.next/dev/lock` failures.
    reuseExistingServer: true,
    env: {
      PORT: "3000",
      // Use IPv4 loopback explicitly to avoid Windows resolving `localhost` to `::1` and causing connection issues.
      NEXTAUTH_URL: "http://127.0.0.1:3000",
      E2E_SECRET: process.env.E2E_SECRET || "local-e2e",
      NODE_ENV: "development",
    },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
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

