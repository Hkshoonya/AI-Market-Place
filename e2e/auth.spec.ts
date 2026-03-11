import { test, expect } from "@playwright/test";
import { injectMockAuth } from "./helpers/auth";

/**
 * Auth flow E2E tests.
 *
 * Tests run fully offline with dummy NEXT_PUBLIC_SUPABASE_URL. The middleware
 * wraps getUser() in try/catch so server-side errors are treated as "no session".
 *
 * Login form interaction tests verify the form UI renders and is functional.
 * Authenticated-state tests use injectMockAuth() which sets context-level
 * cookie + route intercepts — this works reliably because context.route()
 * intercepts at the browser context level before requests leave the browser.
 */
test.describe("Auth flow", () => {
  // ---------------------------------------------------------------------------
  // Test 1: Login page renders form and accepts input
  // ---------------------------------------------------------------------------
  test("login page renders form with email, password, and submit button", async ({
    page,
  }) => {
    await page.goto("/login");

    // Verify the login page renders with all expected elements
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign In" })
    ).toBeVisible();

    // Fill form — verifies inputs are interactive
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword123");

    // Verify values were set
    await expect(page.getByLabel("Email address")).toHaveValue(
      "test@example.com"
    );
    await expect(page.getByLabel("Password")).toHaveValue("testpassword123");

    // Submit triggers signInWithPassword — in offline mode this fails with
    // "Failed to fetch" which the form displays as an error alert
    await page.getByRole("button", { name: "Sign In" }).click();

    // The form should show an error (network failure in offline mode)
    const errorAlert = page.locator('[role="alert"]').first();
    await expect(errorAlert).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Login page preserves redirect parameter
  // ---------------------------------------------------------------------------
  test("login page shows redirect parameter in URL", async ({ page }) => {
    await page.goto("/login?redirect=/models");

    // Page renders with the redirect param preserved
    await expect(page).toHaveURL(/redirect=%2Fmodels|redirect=\/models/);
    await expect(page.getByLabel("Email address")).toBeVisible();

    // OAuth buttons and email form are present
    await expect(
      page.getByRole("button", { name: /github/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /google/i })
    ).toBeVisible();

    // Sign up link is present
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Test 3: Form submission with bad credentials shows error
  // ---------------------------------------------------------------------------
  test("form submission shows error message on failure", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email address").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    // In offline mode, signInWithPassword fails with a network error.
    // The form captures the error and displays it in a role="alert" div.
    const errorAlert = page.locator('[role="alert"]').first();
    await expect(errorAlert).toBeVisible({ timeout: 5_000 });

    // Verify error text is non-empty (exact message varies: "Failed to fetch"
    // offline vs "Invalid login credentials" with real Supabase)
    const alertText = await errorAlert.textContent();
    expect(alertText).toBeTruthy();

    // User stays on login page
    await expect(page).toHaveURL(/\/login/);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Session persists across page reload
  // ---------------------------------------------------------------------------
  test("session persists across page reload", async ({ page, context }) => {
    await injectMockAuth(context);

    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    const userMenuButton = page.getByRole("button", { name: /user menu/i });
    await expect(userMenuButton).toBeVisible({ timeout: 15_000 });

    // Reload — context-level intercepts persist
    await page.reload();

    // Auth state preserved after reload
    await expect(userMenuButton).toBeVisible({ timeout: 15_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Authenticated user sees session indicator, logout clears it
  // ---------------------------------------------------------------------------
  test("authenticated user sees session indicator, logout clears it", async ({
    page,
    context,
  }) => {
    await injectMockAuth(context);

    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    // Verify authenticated state
    const userMenuButton = page.getByRole("button", { name: /user menu/i });
    await expect(userMenuButton).toBeVisible({ timeout: 15_000 });

    const signInLink = page.getByRole("link", { name: "Sign In" });
    await expect(signInLink).not.toBeVisible();

    // Open menu and sign out
    await userMenuButton.click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Sign In link reappears
    await expect(signInLink).toBeVisible({ timeout: 5_000 });
  });
});
