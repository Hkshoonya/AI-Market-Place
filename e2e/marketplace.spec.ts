import { test, expect } from "@playwright/test";

/**
 * Marketplace E2E tests.
 *
 * All tests run fully offline — the dev server starts with dummy Supabase env
 * vars (configured in playwright.config.ts webServer.env). The marketplace
 * browse page is a Server Component with server-side Supabase queries.
 * With a dummy URL, those queries fail/return empty data gracefully.
 *
 * Tests verify:
 *   - Page shell (heading, filter bar) renders even with zero listings
 *   - Server-side URL param parsing (search query, type filter, sort)
 *   - Listing navigation when listings are present
 *
 * The filter bar is a Client Component and renders regardless of DB data.
 * The h1 heading uses server-side URL param parsing that works independently
 * of the database connection.
 */
test.describe("Marketplace", () => {
  // ---------------------------------------------------------------------------
  // Shared REST mock — prevents server component Supabase errors from
  // propagating in ways that break page rendering.
  // ---------------------------------------------------------------------------
  const mockRestEmpty = async (page: import("@playwright/test").Page) => {
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
        headers: { "content-range": "0-0/0" },
      });
    });
  };

  // ---------------------------------------------------------------------------
  // Test 1: Browse page loads with heading and filter bar
  // ---------------------------------------------------------------------------
  test("browse page loads with heading and filter bar", async ({ page }) => {
    await mockRestEmpty(page);

    await page.goto("/marketplace/browse");

    // Default heading when no search or type params
    await expect(
      page.getByRole("heading", { name: /browse marketplace/i })
    ).toBeVisible({ timeout: 15_000 });

    // Filter bar is a client component — always renders
    // It contains the search input
    const searchInput = page.getByRole("textbox", {
      name: /search marketplace listings/i,
    });
    await expect(searchInput).toBeVisible();

    // Sort options group is rendered
    const sortGroup = page.getByRole("group", { name: /sort options/i });
    await expect(sortGroup).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Test 2: Search via URL parameter shows search heading
  // ---------------------------------------------------------------------------
  test("search via URL parameter shows search heading", async ({ page }) => {
    await mockRestEmpty(page);

    await page.goto("/marketplace/browse?q=test");

    // Server-side: search param → heading becomes `Search: "test"`
    await expect(
      page.getByRole("heading", { name: /search: "test"/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Type filter via URL parameter shows filtered heading
  //
  // api_access → "API Access" (from LISTING_TYPE_MAP)
  // ---------------------------------------------------------------------------
  test("type filter via URL parameter shows filtered heading", async ({
    page,
  }) => {
    await mockRestEmpty(page);

    await page.goto("/marketplace/browse?type=api_access");

    // Server-side type param → heading becomes the typeConfig.label = "API Access"
    await expect(
      page.getByRole("heading", { name: /api access/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Sort parameter changes page without error
  // ---------------------------------------------------------------------------
  test("sort parameter changes page without error", async ({ page }) => {
    await mockRestEmpty(page);

    // price_asc sort
    await page.goto("/marketplace/browse?sort=price_asc");

    // Heading should still be "Browse Marketplace" (no type/search param)
    await expect(
      page.getByRole("heading", { name: /browse marketplace/i })
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to popular sort
    await page.goto("/marketplace/browse?sort=popular");

    await expect(
      page.getByRole("heading", { name: /browse marketplace/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Clicking a listing navigates to detail page
  //
  // With dummy Supabase env vars the browse page returns zero listings.
  // This test skips gracefully if no listing links exist.
  // ---------------------------------------------------------------------------
  test("clicking a listing navigates to detail page", async ({ page }) => {
    await mockRestEmpty(page);

    await page.goto("/marketplace/browse");

    // Wait for the page to settle
    await expect(
      page.getByRole("heading", { name: /browse marketplace/i })
    ).toBeVisible({ timeout: 15_000 });

    // Listing links: any /marketplace/ link that is NOT /marketplace/browse
    const listingLinks = page
      .locator("a[href*='/marketplace/']")
      .filter({ hasNot: page.locator("a[href='/marketplace/browse']") });

    const count = await listingLinks.count();

    if (count === 0) {
      // No listings loaded (offline / dummy env vars) — skip gracefully
      test.skip();
      return;
    }

    // Click the first listing and verify navigation to a detail page
    const href = await listingLinks.first().getAttribute("href");
    await listingLinks.first().click();

    // URL should change to a /marketplace/[slug] path
    await expect(page).toHaveURL(/\/marketplace\/(?!browse)/, {
      timeout: 10_000,
    });

    if (href) {
      await expect(page).toHaveURL(href, { timeout: 10_000 });
    }
  });
});
