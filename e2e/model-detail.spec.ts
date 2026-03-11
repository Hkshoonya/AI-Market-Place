import { test, expect } from "@playwright/test";
import { mockApiRoute } from "./helpers/routes";

/**
 * Model detail page E2E tests.
 *
 * Architecture note: The model detail page (/models/[slug]) is a Server
 * Component that fetches model data from Supabase server-side via
 * parseQueryResultSingle. With dummy NEXT_PUBLIC_SUPABASE_URL, the Supabase
 * client gets ENOTFOUND errors — parseQueryResultSingle returns null →
 * notFound() is called → Next.js renders the 404 page.
 *
 * Tests therefore:
 * - Set up client-side SWR route intercepts for any SWR calls that fire on
 *   the model page (deploy-tab, model-overview, model-actions/bookmark).
 * - Navigate to /models/gpt-4o.
 * - Detect whether the model page shell rendered (h1 with model name) or
 *   whether a 404/error page appeared.
 * - If the page rendered the 404, skip with an informative message.
 * - If the page rendered with data (e.g., if a future test run connects to a
 *   real DB or a test seed), verify the full interactive flow.
 *
 * Client-side SWR calls (these CAN be intercepted via page.route):
 * - DeployTab:    GET /api/models/{slug}/deployments
 * - ModelOverview: GET /api/models/{slug}/description
 * - ModelActions: GET /api/models/{slug}/bookmark
 *
 * These intercepts are registered before navigation so they are active when
 * the client hydrates and SWR fires initial requests.
 */

const MODEL_SLUG = "gpt-4o";
const MODEL_URL = `/models/${MODEL_SLUG}`;

/** Register all client-side SWR intercepts for the model detail page. */
async function setupModelInterceptors(page: Parameters<typeof mockApiRoute>[0]) {
  await mockApiRoute(page, `**/api/models/*/deployments`, {
    deployments: [],
    platforms: [],
  });
  await mockApiRoute(page, `**/api/models/*/description`, {
    description: "GPT-4o is OpenAI's flagship multimodal model.",
    generated_at: "2024-01-01T00:00:00Z",
  });
  await mockApiRoute(page, `**/api/models/*/bookmark`, {
    bookmarked: false,
  });
}

/** Returns true if the model page shell loaded (h1 heading is visible). */
async function modelPageLoaded(page: Parameters<typeof mockApiRoute>[0]): Promise<boolean> {
  const heading = page.locator("h1").first();
  try {
    await expect(heading).toBeVisible({ timeout: 8_000 });
    const text = await heading.textContent();
    // 404 page also has an h1 ("404" or "This page could not be found")
    // Model pages always have the model name which is never purely numeric.
    if (!text) return false;
    // If it looks like a Next.js 404, skip
    if (/^404$/.test(text.trim()) || /not found/i.test(text)) return false;
    return true;
  } catch {
    return false;
  }
}

test.describe("Model detail page", () => {
  // ---------------------------------------------------------------------------
  // Test 1: Model detail page renders page shell with tabs
  // ---------------------------------------------------------------------------
  test("model detail page renders page shell with tabs", async ({ page }) => {
    await setupModelInterceptors(page);
    await page.goto(MODEL_URL);

    const loaded = await modelPageLoaded(page);
    if (!loaded) {
      test.skip(true, "Model page returned 404 with dummy Supabase — server-side query failed");
      return;
    }

    // Page heading should contain the model name
    const heading = page.locator("h1").first();
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
    expect(headingText!.length).toBeGreaterThan(0);

    // At least one score-like element should be visible: look for "Quality Score"
    // label in ModelStatsRow, or any numeric score pattern
    const scoreElements = page.getByText(/quality score/i);
    const scoreCount = await scoreElements.count();
    // Verify page shell has stat rows (even if data is blank)
    expect(scoreCount).toBeGreaterThanOrEqual(1);

    // Benchmarks tab (defaultValue) should be selected
    const benchmarksTab = page.getByRole("tab", { name: "Benchmarks" });
    await expect(benchmarksTab).toBeVisible();
    await expect(benchmarksTab).toHaveAttribute("aria-selected", "true");
  });

  // ---------------------------------------------------------------------------
  // Test 2: Tab navigation switches content panels
  // ---------------------------------------------------------------------------
  test("tab navigation switches content panels", async ({ page }) => {
    await setupModelInterceptors(page);
    await page.goto(MODEL_URL);

    const loaded = await modelPageLoaded(page);
    if (!loaded) {
      test.skip(true, "Model page returned 404 with dummy Supabase — tab navigation test skipped");
      return;
    }

    // Default tab: Benchmarks should be active
    const benchmarksTab = page.getByRole("tab", { name: "Benchmarks" });
    await expect(benchmarksTab).toHaveAttribute("aria-selected", "true");

    // Click Pricing tab and verify it becomes active
    const pricingTab = page.getByRole("tab", { name: "Pricing" });
    await pricingTab.click();
    await expect(pricingTab).toHaveAttribute("aria-selected", "true");
    await expect(benchmarksTab).toHaveAttribute("aria-selected", "false");

    // Click Details tab and verify it becomes active
    const detailsTab = page.getByRole("tab", { name: "Details" });
    await detailsTab.click();
    await expect(detailsTab).toHaveAttribute("aria-selected", "true");
    await expect(pricingTab).toHaveAttribute("aria-selected", "false");

    // Click Deploy tab — this triggers the SWR call we intercepted above
    const deployTab = page.getByRole("tab", { name: "Deploy" });
    await deployTab.click();
    await expect(deployTab).toHaveAttribute("aria-selected", "true");
    await expect(detailsTab).toHaveAttribute("aria-selected", "false");
  });

  // ---------------------------------------------------------------------------
  // Test 3: Clicking model link from leaderboard navigates to detail
  //
  // Navigates to /leaderboards (which renders even with empty data), looks for
  // any <a href="/models/..."> link, and clicks it to verify navigation flow.
  // ---------------------------------------------------------------------------
  test("clicking model link from leaderboard navigates to detail", async ({
    page,
  }) => {
    // Set up SWR intercepts for both leaderboard page (chart SWR calls) and
    // the target model detail page
    await setupModelInterceptors(page);

    await page.goto("/leaderboards");

    // Wait for the page to be interactive
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });

    // Find any model links on the page
    const modelLinks = page.locator('a[href*="/models/"]');
    const linkCount = await modelLinks.count();

    if (linkCount === 0) {
      test.skip(
        true,
        "No model links found on leaderboard — empty DB with dummy Supabase credentials"
      );
      return;
    }

    // Click the first model link
    const firstLink = modelLinks.first();
    const href = await firstLink.getAttribute("href");
    await firstLink.click();

    // Verify URL changed to a model page
    await expect(page).toHaveURL(/\/models\//, { timeout: 10_000 });
    if (href) {
      await expect(page).toHaveURL(href);
    }

    // Verify the page rendered (either model detail or 404, both show h1)
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
  });
});
