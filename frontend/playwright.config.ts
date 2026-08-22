import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the "UI Tests" layer of the test suite.
 *
 * These tests exercise the real Next.js app in a real browser against the
 * real FastAPI backend (docker-compose stack) — they are the outermost
 * layer, sitting above the backend's unit/integration/e2e (API-level)
 * tests. Start the stack first:
 *
 *   docker compose up -d          # postgres + minio + backend
 *   cd frontend && npm run dev    # frontend on :3000
 *   npm run test:e2e              # runs this config
 *
 * BASE_URL / API_URL can be overridden for CI or staging runs.
 */
export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
