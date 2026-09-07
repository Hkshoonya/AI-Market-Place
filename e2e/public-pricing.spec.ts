import { test, expect } from "@playwright/test";

test.describe("Public pricing without login", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:54321/**", (route) => route.fulfill({
      status: route.request().url().includes("/auth/") ? 401 : 200,
      contentType: "application/json",
      body: route.request().url().includes("/auth/") ? '{"message":"not_authorized"}' : "[]",
    }));
    await page.route("**/api/models/*/description", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ summary: "Fixture model overview", pros: [], cons: [], best_for: [], not_ideal_for: [], comparison_notes: null, generated_by: "ai", upvotes: 0, downvotes: 0 }),
    }));
    await page.route("**/api/models/*/bookmark", (route) => route.fulfill({
      contentType: "application/json", body: '{"bookmarked":false}',
    }));
  });

  test("shows prices, quotas, and pilot restrictions without a session", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Rates & subscription plans", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/pricing$/);
    const main = page.getByRole("main");
    await expect(main.getByText(/without an account/)).toBeVisible();
    const plans = main.locator("#data-api-plans");
    for (const price of ["$0", "$49", "$199"]) {
      await expect(plans.getByText(price, { exact: true })).toBeVisible();
    }
    await expect(plans.getByText("100,000 requests / month", { exact: true })).toBeVisible();
    await expect(plans.getByText(/paid checkout is not enabled/)).toBeVisible();
    await expect(plans.getByText("Proposed price; pilot request only, not available to buy")).toHaveCount(2);
    await expect(plans.getByRole("link", { name: "Request Pro pilot" })).toHaveAttribute("href", /\/contact\?/);
    await expect(plans.getByRole("link", { name: /buy|checkout|subscribe/i })).toHaveCount(0);
    expect((await page.context().cookies()).some((cookie) => cookie.name.includes("auth-token"))).toBe(false);
  });

  test("keeps subscription prices visible and the layout within the viewport", async ({ page }, testInfo) => {
    await page.goto("/pricing");
    const providerSection = page.getByRole("region", { name: "Provider subscriptions" });
    await expect(providerSection.getByText("Example Research Plan")).toBeVisible();
    await expect(providerSection.getByText("$19.99/mo", { exact: true })).toBeVisible();
    await expect(providerSection.getByText("Free access notes: Limited free tier")).toBeVisible();
    await expect(providerSection.getByText("Trial", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("public-pricing.png"), fullPage: true });
  });

  test("links to pricing from the main navigation without signing in", async ({ page }) => {
    await page.goto("/pricing");
    const desktop = page.getByRole("navigation", { name: "Main navigation", exact: true });
    if (await desktop.isVisible()) {
      await expect(desktop.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      const mobile = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
      await expect(mobile.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
      await mobile.getByRole("link", { name: "Pricing", exact: true }).click();
      await expect(mobile).not.toBeVisible();
    }
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test("shows model rates before the tabs and opens the pricing tab for guests", async ({ page }) => {
    await page.goto("/models/deepseek-r1");
    const summary = page.getByRole("region", { name: "Rates & subscription access" });
    await expect(summary).toBeVisible();
    await expect(summary.getByText("$19.99/mo", { exact: true })).toBeVisible();
    const tabs = page.getByRole("main").locator("#model-tabs");
    expect(await summary.evaluate((element) => element.getBoundingClientRect().top))
      .toBeLessThan(await tabs.evaluate((element) => element.getBoundingClientRect().top));
    await summary.getByRole("link", { name: "View full pricing details" }).click();
    await expect(page).toHaveURL(/\/models\/deepseek-r1\?tab=pricing#model-tabs$/);
    await expect(page.getByRole("tab", { name: "Pricing", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByText(/Public pricing, no login required/)).toBeVisible();
  });
});
