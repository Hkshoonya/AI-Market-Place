import type { BrowserContext } from "@playwright/test";

/**
 * Injects mock Supabase authentication into a browser context.
 *
 * The @supabase/ssr createBrowserClient stores sessions in document.cookie
 * (not localStorage). The cookie format is:
 *   name:  sb-{supabase-project-ref}-auth-token
 *   value: base64-{base64url(JSON.stringify(session))}
 *
 * With NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321:
 *   project ref = "localhost" (first hostname segment)
 *   cookie name = "sb-localhost-auth-token"
 *
 * We use context.addInitScript to set document.cookie BEFORE the page scripts
 * run, so the Supabase client sees the session immediately on mount.
 *
 * We also register context.route intercepts for /auth/v1/user in case the
 * client tries to verify or refresh the mock token via a network call.
 *
 * Call this BEFORE page.goto(). Tests run fully offline.
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

  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  const mockSession = {
    access_token: "mock-access-token-for-e2e-testing",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: "mock-refresh-token-for-e2e-testing",
    user: mockUser,
  };
  const mockProfile = {
    id: mockUser.id,
    username: "e2e-tester",
    display_name: "E2E Tester",
    avatar_url: null,
    bio: null,
    is_admin: false,
    is_seller: false,
    seller_verified: false,
    joined_at: "2024-01-01T00:00:00Z",
  };

  // Encode session as base64url and prefix with "base64-" to match @supabase/ssr
  // encoding. Node.js Buffer.toString('base64url') uses the same URL-safe alphabet.
  const sessionJson = JSON.stringify(mockSession);
  const encoded =
    "base64-" + Buffer.from(sessionJson, "utf-8").toString("base64url");

  // Cookie name: sb-{first-hostname-segment}-auth-token
  // NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 → sb-localhost-auth-token
  const cookieName = "sb-localhost-auth-token";
  const authCacheKey = "ai-market-cap.auth";
  const e2eAuthOverrideKey = "ai-market-cap.e2e-auth";
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

  await context.addCookies([
    {
      name: cookieName,
      value: encoded,
      url: "http://127.0.0.1/",
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
  ]);

  // Inject the session cookie before page scripts run.
  // addInitScript runs in the browser context before any page script execution.
  await context.addInitScript(
    ({ name, value, cacheKey, user, profile }) => {
      document.cookie = `${name}=${value}; path=/; max-age=3600; SameSite=Lax`;
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          user,
          profile,
        })
      );
    },
    {
      name: cookieName,
      value: encoded,
      cacheKey: authCacheKey,
      user: mockUser,
      profile: mockProfile,
    }
  );

  // Network intercepts — handle any /auth/v1/user network calls from the
  // Supabase client (e.g. when it validates or refreshes the injected session)
  await context.route("**/auth/v1/user**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockUser),
    });
  });

  // Handle /auth/v1/token calls (token refresh attempts with the mock refresh token)
  await context.route("**/auth/v1/token**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSession),
    });
  });

  await context.route("**/rest/v1/profiles**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockProfile),
      headers: {
        "content-range": "0-0/1",
      },
    });
  });

  // Prime the actual app origin so client-side auth bootstrap can read the
  // cached state immediately, even before any intercepted auth refresh calls.
  const primingPage = await context.newPage();
  await primingPage.goto(baseUrl);
  await primingPage.evaluate(
    ({ name, value, cacheKey, e2eKey, user, profile }) => {
      document.cookie = `${name}=${value}; path=/; max-age=3600; SameSite=Lax`;
      const payload = JSON.stringify({ user, profile });
      window.localStorage.setItem(cacheKey, payload);
      window.localStorage.setItem(e2eKey, payload);
    },
    {
      name: cookieName,
      value: encoded,
      cacheKey: authCacheKey,
      e2eKey: e2eAuthOverrideKey,
      user: mockUser,
      profile: mockProfile,
    }
  );
  await primingPage.close();
}
