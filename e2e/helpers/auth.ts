import type { BrowserContext } from "@playwright/test";

/**
 * Injects mock Supabase authentication into a browser context.
 *
 * This intercepts two Supabase endpoints at the network level so that:
 * 1. The Next.js middleware (which calls /auth/v1/user to check auth) sees an
 *    authenticated user and allows access to protected routes.
 * 2. The client-side AuthProvider (which also calls /auth/v1/user on mount)
 *    hydrates with the same mock user, showing the authenticated UI.
 *
 * Call this BEFORE navigating to any page — the middleware fires on navigation
 * and needs the intercept to be registered first.
 *
 * No real Supabase credentials or network calls are made. Tests run fully offline.
 */
export async function injectMockAuth(context: BrowserContext): Promise<void> {
  const mockUser = {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "e2e-test@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
    phone: "",
    confirmed_at: "2024-01-01T00:00:00Z",
    last_sign_in_at: "2024-01-01T00:00:00Z",
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
    user_metadata: {
      full_name: "E2E Tester",
    },
    identities: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockSession = {
    access_token: "mock-access-token-for-e2e-testing",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token-for-e2e-testing",
    user: mockUser,
  };

  // Intercept /auth/v1/user — called by middleware on every request and by
  // client-side AuthProvider on mount. Returns the authenticated user object.
  await context.route("**/auth/v1/user**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockUser),
    });
  });

  // Intercept /auth/v1/token — called by supabase.auth.signInWithPassword() in
  // the login form. Returns a full session including access_token + user.
  await context.route("**/auth/v1/token**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSession),
    });
  });
}
