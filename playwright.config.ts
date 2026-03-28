import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for AI Market Cap E2E tests.
 *
 * Strategy: fully offline — all Supabase auth/REST calls are intercepted by
 * page.route() or context.route() before hitting the network. The dummy env
 * vars below are needed so Next.js can start without crashing; they never
 * reach the real Supabase service during tests.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "playwright-results",
  reporter: process.env.CI ? "github" : "html",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Dummy values so Next.js starts without "SUPABASE_URL is required" errors.
      // All actual Supabase API calls are intercepted at the browser level by
      // page.route() / context.route() — no real network traffic leaves the machine.
      // MSW intercepts server-side RSC Supabase calls via instrumentation.ts.
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      CRON_SECRET: "test-cron-secret",
      NEXT_PUBLIC_E2E_MSW: "true",
    },
  },
});
