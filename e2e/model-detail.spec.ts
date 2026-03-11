import { test, expect } from "@playwright/test";
import { mockApiRoute } from "./helpers/routes";

/**
 * Model detail page E2E tests.
 *
 * MSW running via instrumentation.ts intercepts server-side Supabase
 * PostgREST calls and returns fixture data from e2e/fixtures/model-detail.json.
 * This enables real assertions without test.skip() fallback patterns.
 *
 * Client-side SWR calls (intercepted via page.route):
 * - DeployTab:      GET /api/models/{slug}/deployments
 * - ModelOverview:  GET /api/models/{slug}/description
 * - ModelActions:   GET /api/models/{slug}/bookmark
 *
 * Browser-level Supabase intercepts prevent CSP violations and React hydration
 * errors when the browser tries to fetch from localhost:54321.
 *
 * Note on streaming SSR: Next.js streams the page response progressively.
 * Tabs content arrives ~2s after domcontentloaded. Element waits use generous
 * timeouts to accommodate this streaming behavior.
 */

const MODEL_SLUG = "deepseek-r1";
const MODEL_URL = `/models/${MODEL_SLUG}`;

/**
 * Register all client-side intercepts for the model detail page.
 * Intercepts both Next.js API routes (SWR) and direct Supabase browser calls.
 */
async function setupModelInterceptors(page: Parameters<typeof mockApiRoute>[0]) {
  // SWR API routes
  await mockApiRoute(page, `**/api/models/*/deployments`, {
    deployments: [],
    platforms: [],
  });
  await mockApiRoute(page, `**/api/models/*/description`, {
    summary: "DeepSeek-R1 is a reasoning-focused model trained with reinforcement learning.",
    pros: [],
    cons: [],
    best_for: [],
    not_ideal_for: [],
    comparison_notes: null,
    generated_by: "ai",
    upvotes: 0,
    downvotes: 0,
  });
  await mockApiRoute(page, `**/api/models/*/bookmark`, {
    bookmarked: false,
  });

  // Intercept ALL browser-level Supabase calls to localhost:54321.
  // Without these, the browser gets CSP violations from attempting to connect
  // to localhost:54321, which triggers React error boundaries.
  await page.route("http://localhost:54321/**", (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/")) {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "not_authorized" }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    }
  });
}

test.describe("Model detail page", () => {
  // ---------------------------------------------------------------------------
  // Test 1: Model detail page renders page shell with tabs
  // ---------------------------------------------------------------------------
  test("model detail page renders page shell with tabs", async ({ page }) => {
    await setupModelInterceptors(page);
    // Use default waitUntil ('load') — this waits for streaming SSR to complete
    await page.goto(MODEL_URL);

    // MSW ensures the page renders with fixture data — no skip needed.
    // Wait for the main content area heading.
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 20_000 });
    const headingText = await heading.textContent();
    expect(headingText).toContain("DeepSeek-R1");

    // Stats row: quality score label
    await expect(page.getByText(/quality score/i).first()).toBeVisible({ timeout: 10_000 });

    // Benchmarks tab (defaultValue="benchmarks") should be selected.
    // Tabs arrive after streaming SSR completes — wait with generous timeout.
    const benchmarksTab = page.getByRole("tab", { name: "Benchmarks" });
    await expect(benchmarksTab).toBeVisible({ timeout: 10_000 });
    await expect(benchmarksTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Tab navigation switches content panels
  // ---------------------------------------------------------------------------
  test("tab navigation switches content panels", async ({ page }) => {
    await setupModelInterceptors(page);
    await page.goto(MODEL_URL);

    // Wait for the page heading and Benchmarks tab (streaming SSR may delay tabs)
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
    const benchmarksTab = page.getByRole("tab", { name: "Benchmarks" });
    await expect(benchmarksTab).toBeVisible({ timeout: 10_000 });
    await expect(benchmarksTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });

    // Click Pricing tab
    const pricingTab = page.getByRole("tab", { name: "Pricing" });
    await pricingTab.click();
    await expect(pricingTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
    await expect(benchmarksTab).toHaveAttribute("aria-selected", "false", { timeout: 5_000 });
    // Pricing tab content: fixture has model_pricing; table renders "$/M" column headers
    await expect(page.getByText(/\$\/M/i).first()).toBeVisible({ timeout: 5_000 });

    // Click Details tab
    const detailsTab = page.getByRole("tab", { name: "Details" });
    await detailsTab.click();
    await expect(detailsTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
    await expect(pricingTab).toHaveAttribute("aria-selected", "false", { timeout: 5_000 });
    // Details tab: fixture has architecture "Transformer (MoE)"
    await expect(page.getByText(/transformer/i).first()).toBeVisible({ timeout: 5_000 });

    // Click Deploy tab
    const deployTab = page.getByRole("tab", { name: "Deploy" });
    await deployTab.click();
    await expect(deployTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
    await expect(detailsTab).toHaveAttribute("aria-selected", "false", { timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Cross-navigation from model detail back to models list
  //
  // Navigates directly to /models/deepseek-r1 (MSW handles server-side data),
  // finds the "Back to Models" link, and verifies navigation occurs.
  // ---------------------------------------------------------------------------
  test("leaderboard cross-navigation", async ({ page }) => {
    await setupModelInterceptors(page);
    await page.goto(MODEL_URL);

    // Wait for page to render with fixture data
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 20_000 });
    await expect(heading).toContainText("DeepSeek-R1");

    // Find "Back to Models" link
    const backLink = page.getByRole("link", { name: /back to models/i });
    await expect(backLink).toBeVisible({ timeout: 10_000 });

    // Click back link and wait for URL to change to /models
    await Promise.all([
      page.waitForURL(/\/models$/, { timeout: 15_000 }),
      backLink.click(),
    ]);
    await expect(page).toHaveURL(/\/models$/);
  });
});
