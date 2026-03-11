import type { Page } from "@playwright/test";

/**
 * Intercepts client-side SWR fetch calls to /api/* endpoints at the browser level.
 *
 * Use this to mock API routes that are fetched by SWR hooks in client components.
 * Register intercepts BEFORE navigation so the route handler is in place when the
 * page hydrates and SWR fires its initial requests.
 *
 * NOTE: This intercepts BROWSER-SIDE fetches only (SWR hooks, client fetch calls).
 * It cannot intercept server-side RSC data fetching or Supabase client calls made
 * in Server Components. For server-rendered pages, test the rendered output only.
 *
 * Example usage:
 *   await mockApiRoute(page, "** /api/models/gpt-4/description", { description: "..." });
 *   await page.goto("/models/gpt-4");
 */
export async function mockApiRoute(
  page: Page,
  urlPattern: string,
  fixture: unknown
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });
}

/**
 * Intercepts Supabase RPC endpoint calls from the browser.
 *
 * Supabase RPC calls go to rest/v1/rpc/{rpcName}.
 * Use this to mock specific RPC functions without intercepting all REST calls.
 *
 * Example usage:
 *   await mockSupabaseRpc(page, "get_leaderboard", { data: [] });
 */
export async function mockSupabaseRpc(
  page: Page,
  rpc: string,
  response: unknown
): Promise<void> {
  const pattern = `**/rest/v1/rpc/${rpc}**`;
  await page.route(pattern, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}
