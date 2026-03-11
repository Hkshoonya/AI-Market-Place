import { test, expect } from "@playwright/test";
import { injectMockAuth } from "./helpers/auth";

/**
 * Auth flow E2E tests.
 *
 * All tests run fully offline — Supabase auth endpoints are intercepted at the
 * browser level by page.route() / context.route() before any network call
 * leaves the browser (client-side fetches from AuthProvider / login form).
 *
 * The dev server starts with dummy NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
 * (configured in playwright.config.ts webServer.env). The middleware wraps
 * getUser() in a try/catch so server-side ENOTFOUND errors are treated as
 * "no session" — non-protected routes load normally, protected routes redirect
 * to /login as expected.
 *
 * Rule: Register ALL route intercepts BEFORE page.goto() because the
 * middleware fires on the very first request.
 */
test.describe("Auth flow", () => {
  // ---------------------------------------------------------------------------
  // Shared mock objects
  // ---------------------------------------------------------------------------
  const mockUser = {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: { full_name: "E2E Tester" },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockSession = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user: mockUser,
  };

  // ---------------------------------------------------------------------------
  // Test 1: Email login fills form, submits, and redirects to home
  // ---------------------------------------------------------------------------
  test("email login fills form, submits, and redirects to home", async ({
    page,
  }) => {
    // Register intercepts BEFORE navigation
    await page.route("**/auth/v1/token**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSession),
      });
    });

    await page.route("**/auth/v1/user**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    // Mock Supabase REST and any other external API calls for the home page
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/login");

    // Fill form using accessible labels (matching aria-label attributes in login-form.tsx)
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword123");

    // Submit — triggers supabase.auth.signInWithPassword() which POSTs to /auth/v1/token
    await page.getByRole("button", { name: "Sign In" }).click();

    // login-form.tsx calls router.push(redirectTo) then router.refresh()
    // Default redirectTo is "/" when no ?redirect param
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Login with redirect parameter returns to original page
  //
  // We use /models as the redirect target (a non-protected route) so the
  // middleware allows access without server-side auth verification.
  // This tests the redirect param parsing logic in login-form.tsx.
  // ---------------------------------------------------------------------------
  test("login with redirect parameter returns to original page", async ({
    page,
  }) => {
    // Register intercepts before navigation
    await page.route("**/auth/v1/token**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSession),
      });
    });

    await page.route("**/auth/v1/user**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    // Mock REST for the redirect target page
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Use /models (non-protected route) so the redirect works end-to-end
    await page.goto("/login?redirect=/models");

    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // login-form.tsx reads ?redirect param, validates it starts with "/" and
    // has no protocol/double-slash, then calls router.push(redirectTo)
    await expect(page).toHaveURL("/models", { timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Invalid credentials show error message
  // ---------------------------------------------------------------------------
  test("invalid credentials show error message", async ({ page }) => {
    // /auth/v1/user for middleware — returns error so page renders (login is not protected)
    await page.route("**/auth/v1/user**", (route) => {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_authenticated" }),
      });
    });

    // Intercept /auth/v1/token with 400 — simulating wrong password
    await page.route("**/auth/v1/token**", (route) => {
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    await page.goto("/login");

    await page.getByLabel("Email address").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    // login-form.tsx sets error state on auth failure → renders div[role="alert"]
    // Use .first() because Next.js also renders a route-announcer with role="alert"
    const errorAlert = page
      .locator('[role="alert"]')
      .filter({ hasText: /invalid/i })
      .first();

    await expect(errorAlert).toBeVisible({ timeout: 5_000 });

    const alertText = await errorAlert.textContent();
    expect(alertText).toBeTruthy();
    expect(alertText?.toLowerCase()).toContain("invalid");
  });

  // ---------------------------------------------------------------------------
  // Test 4: Session persists across page reload
  // ---------------------------------------------------------------------------
  test("session persists across page reload", async ({ page, context }) => {
    // injectMockAuth registers intercepts on the BrowserContext — they persist
    // across navigations and page reloads within this test.
    // These intercept the CLIENT-SIDE browser fetch to /auth/v1/user, which is
    // what AuthProvider calls on mount and after reload.
    await injectMockAuth(context);

    // Mock REST calls so home page server components don't throw DB errors
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    // AuthButton renders a user menu trigger when authenticated.
    // The button has aria-label="User menu for {displayName}" — matches auth-button.tsx
    const userMenuButton = page.getByRole("button", { name: /user menu/i });
    await expect(userMenuButton).toBeVisible({ timeout: 15_000 });

    // Reload — context-level intercepts persist, so /auth/v1/user continues
    // returning the mock user after reload (AuthProvider re-initializes)
    await page.reload();

    // Auth state should be preserved after reload
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

    // Mock REST so home page server components don't throw
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    // Verify authenticated state — user menu button visible, Sign In link absent
    const userMenuButton = page.getByRole("button", { name: /user menu/i });
    await expect(userMenuButton).toBeVisible({ timeout: 15_000 });

    const signInLink = page.getByRole("link", { name: "Sign In" });
    await expect(signInLink).not.toBeVisible();

    // Open the user dropdown menu
    await userMenuButton.click();

    // Click "Sign Out" from the dropdown (matches "Sign Out" text in auth-button.tsx)
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // After sign out, AuthProvider calls supabase.auth.signOut() which clears
    // the local session. The client state switches back to unauthenticated.
    // The "Sign In" link reappears in the AuthButton component.
    await expect(signInLink).toBeVisible({ timeout: 5_000 });
  });
});
