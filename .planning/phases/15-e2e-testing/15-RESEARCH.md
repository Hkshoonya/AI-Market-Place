# Phase 15: E2E Testing - Research

**Researched:** 2026-03-10
**Domain:** Playwright E2E testing with Next.js App Router + Supabase SSR auth mocking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth & data strategy**
- Mock auth at browser level — inject Supabase session cookies/tokens directly into browser context
- One dedicated auth flow test verifies the login UI, but even that uses intercepted routes (fully offline)
- All test data provided via Playwright `route.fulfill()` intercepting API/Supabase calls with fixture JSON
- Shared fixtures directory (`e2e/fixtures/`) with JSON files (models.json, leaderboard.json, listings.json, etc.) reused across tests
- No real Supabase dependency — tests run fully offline

**Test depth per journey**
- **Auth flow:** Full form interaction — fill email + password, submit, verify redirect to dashboard, check session indicator (avatar/name in header), test logout clears session
- **Model detail:** Navigate to model page, verify scores display, click through tabs (overview, benchmarks, pricing, etc.), verify each tab renders content
- **Leaderboard:** Load leaderboard, switch between Capability/Usage/Expert/Balanced lenses and verify models change, click sort column and verify reorder, navigate to page 2
- **Marketplace:** Search for a listing, apply category/price filters, verify results narrow, click a listing, verify detail page shows title/description/price

**CI integration**
- Separate `e2e` job in `ci.yml` alongside existing lint/typecheck/test jobs (runs in parallel)
- Dev server started via Playwright's built-in `webServer` config (`npm run dev`, wait for port)
- E2E is a required status check — PR cannot merge if Playwright fails
- Upload screenshots + trace files as GitHub Actions artifacts on test failure only

**Test environment**
- Browsers: Chromium + Firefox (two browsers for broader coverage)
- Test files live in top-level `e2e/` directory with `*.spec.ts` files
- Viewports: Desktop (1280x720) + mobile (375x667) — both tested
- Retries: `retries: process.env.CI ? 1 : 0` — 1 retry in CI only, none locally

### Claude's Discretion
- Playwright config structure and helper utilities
- Fixture data shapes and exact mock responses
- Test file organization within `e2e/` directory
- Exact selectors and assertion patterns
- `webServer` timeout and port configuration

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | Playwright installed and configured with Next.js dev server | `webServer` config, `playwright.config.ts` structure, browser installation in CI |
| E2E-02 | E2E test for auth flow (signup, login, session persistence) | Supabase auth interception pattern, `route.fulfill()` for `/auth/v1/*` endpoints, storageState injection |
| E2E-03 | E2E test for model detail page (view model, check scores, navigate tabs) | Route interception for `/api/models/*` and Supabase queries; Radix UI Tabs selectors |
| E2E-04 | E2E test for leaderboard (filter by lens, sort, pagination) | `LeaderboardExplorer` client component uses `@tanstack/react-table`; data props from server — intercept Supabase queries at page load |
| E2E-05 | E2E test for marketplace browse (search, filter, view listing) | `BrowsePage` is server-rendered, search via `?q=` URL param; intercept Supabase `marketplace_listings` query |
| E2E-06 | E2E tests integrated into CI pipeline | GitHub Actions workflow addition, browser install step, artifact upload |
</phase_requirements>

---

## Summary

This phase installs Playwright and writes E2E tests for four critical user journeys: auth, model detail, leaderboard, and marketplace. The defining constraint is **fully offline tests** — no real Supabase calls. This is achieved by intercepting all outbound Supabase REST requests via `page.route()` / `context.route()` with `route.fulfill({ json })` and fixture files, and injecting mock auth state into the browser context's storage state to satisfy the `@supabase/ssr` middleware's cookie-based session check.

The existing CI workflow (`.github/workflows/ci.yml`) defines three parallel jobs. A fourth `e2e` job is added following the same Node 24 + `npm ci` pattern, extended with `npx playwright install --with-deps chromium firefox` and artifact upload on failure. Playwright's `webServer` config starts `npm run dev` automatically, removing the need for a separate server process in CI.

The key architectural challenge is that the Next.js middleware calls `supabase.auth.getUser()`, which makes an outbound HTTP request to Supabase's `/auth/v1/user` endpoint on every request. Tests that visit protected routes must intercept this endpoint before navigation. For public routes (leaderboard, marketplace browse), no auth mock is needed — the middleware allows through unauthenticated users.

**Primary recommendation:** Use `context.route('**/auth/v1/**', ...)` to intercept all Supabase auth endpoints globally in a `beforeEach` for authenticated test suites, combined with `context.addCookies()` to inject a fake `sb-*-auth-token` cookie that the middleware's cookie reader will find. For API data (models, rankings, listings), intercept the corresponding Supabase REST table endpoints with fixture JSON.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | 1.50+ (latest stable) | E2E test runner, browser automation | Official Microsoft framework, built-in assertions, fixtures, webServer |
| `playwright` | 1.50+ | Browser binaries (chromium, firefox) | Peer dep of `@playwright/test` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | already in devDeps | Load `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` in `playwright.config.ts` | Needed so `webServer` starts properly |

No additional libraries needed. All mocking is done with built-in Playwright `route.fulfill()` — no MSW, no test database.

**Installation:**
```bash
npm install --save-dev @playwright/test
npx playwright install chromium firefox
```

In CI:
```bash
npx playwright install --with-deps chromium firefox
```

---

## Architecture Patterns

### Recommended Project Structure
```
e2e/
├── fixtures/
│   ├── models.json          # array of model objects (slug, name, scores, tabs)
│   ├── leaderboard.json     # array of LeaderboardModel objects (all 4 lens scores)
│   ├── listings.json        # array of marketplace_listings rows
│   └── auth-session.json    # fake Supabase session for storageState injection
├── helpers/
│   ├── auth.ts              # injectMockAuth(context) — sets cookies + intercepts /auth/v1/user
│   └── routes.ts            # mockSupabaseTable(page, table, fixture) — route.fulfill wrapper
├── auth.spec.ts             # E2E-02
├── model-detail.spec.ts     # E2E-03
├── leaderboard.spec.ts      # E2E-04
└── marketplace.spec.ts      # E2E-05
playwright.config.ts
```

### Pattern 1: Playwright Config with webServer + Multi-Browser Projects

```typescript
// playwright.config.ts
// Source: https://playwright.dev/docs/test-configuration + https://playwright.dev/docs/test-webserver
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'playwright-results',
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Pattern 2: Supabase Auth Mocking (Critical Pattern)

The middleware (`src/middleware.ts`) calls `supabase.auth.getUser()` on every request. This POSTs to `https://<project>.supabase.co/auth/v1/user` with the JWT from cookies. To satisfy the middleware offline:

**Step 1 — Inject a fake session cookie into the browser context:**

The `@supabase/ssr` package reads cookies named `sb-<project-ref>-auth-token` (chunked if large). In tests, inject a fake cookie containing a minimal JWT-shaped token in `storageState` or via `context.addCookies()`.

```typescript
// e2e/helpers/auth.ts
import type { BrowserContext } from '@playwright/test';

// Minimal Supabase session payload — not a real JWT, middleware will call /auth/v1/user anyway
// So we also intercept that endpoint.
export async function injectMockAuth(context: BrowserContext) {
  // 1. Set the cookie the ssr client reads
  await context.addCookies([
    {
      name: 'sb-test-auth-token',
      value: JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'mock-user-id', email: 'test@example.com', role: 'authenticated' },
      }),
      domain: 'localhost',
      path: '/',
    },
  ]);

  // 2. Intercept the /auth/v1/user call that middleware makes to validate the token
  await context.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-user-id',
        email: 'test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
        created_at: '2025-01-01T00:00:00Z',
      }),
    });
  });

  // 3. Intercept token refresh endpoint
  await context.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'mock-user-id', email: 'test@example.com' },
      }),
    });
  });
}
```

> **Why this works:** The middleware's `createServerClient` reads cookies for the JWT, then calls `/auth/v1/user`. By returning a valid user from that intercepted endpoint, the middleware's `getUser()` returns a user and skips the redirect to `/login`.

### Pattern 3: Supabase Table Data Mocking

The leaderboard page fetches from Supabase REST via the JS client, which translates to `GET /rest/v1/models?...`. Intercept at the REST layer:

```typescript
// e2e/helpers/routes.ts
import type { Page } from '@playwright/test';

export async function mockSupabaseTable(
  page: Page,
  table: string,
  fixture: unknown[]
) {
  await page.route(`**/rest/v1/${table}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
      headers: { 'Content-Range': `0-${fixture.length - 1}/${fixture.length}` },
    });
  });
}
```

For marketplace browse (server-rendered), the Supabase call happens in the Next.js server — the route intercept must be set on `context` (not `page`) before the page navigation, so it applies to the server-side fetch as well.

> **Note:** Supabase JS client uses `fetch` internally. In Next.js App Router server components, these fetches originate from the Next.js server process, not the browser — Playwright's `page.route()` only intercepts browser-side network calls. Server-side Supabase calls in RSCs **cannot** be intercepted by Playwright route handlers.

This is the critical architectural constraint for this phase. See "Common Pitfalls" below.

### Pattern 4: Login Form Interaction (Auth Flow Test)

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('login with email + password redirects to home', async ({ page }) => {
  // Intercept Supabase signInWithPassword
  await page.route('**/auth/v1/token?grant_type=password**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user: { id: 'mock-user-id', email: 'test@example.com' },
      }),
    });
  });

  await page.goto('/login');
  await page.fill('[aria-label="Email address"]', 'test@example.com');
  await page.fill('[aria-label="Password"]', 'testpassword');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
});
```

### Pattern 5: route.fulfill() URL Pattern (MEDIUM confidence — needs tuning)

The Supabase JS client constructs REST URLs like:
- `https://<project-ref>.supabase.co/rest/v1/models?select=...`
- `https://<project-ref>.supabase.co/auth/v1/user`

In the Playwright config, `NEXT_PUBLIC_SUPABASE_URL` must be the real URL for the dev server to start. The route patterns use globs, so `**/rest/v1/models**` matches regardless of the actual project ref domain.

### Anti-Patterns to Avoid
- **Real Supabase calls in tests:** Any test that hits real Supabase is fragile, slow, and creates test data. All Supabase traffic must be intercepted.
- **Intercepting server-side RSC fetches with page.route():** Server Component Supabase calls originate from the Node.js server process, not the browser — `page.route()` cannot intercept them. Use URL params to trigger client-side data fetching or mock the response at the page content level.
- **Hard-coded selectors on dynamic class names:** Tailwind classes change. Use `aria-label`, `role`, `data-testid`, or text content selectors instead.
- **Missing `page.unrouteAll()` between tests:** Route handlers accumulate if not cleared. Use `beforeEach` to set routes per test, or register at `context` level per test.
- **Running mobile + desktop as separate test files:** Use Playwright's `projects` array to run the same spec files across different viewport configurations — don't duplicate tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom puppeteer scripts | `@playwright/test` | Built-in assertions, retry logic, fixtures, webServer, tracing |
| Request interception | MSW or custom proxy server | `page.route()` / `route.fulfill()` | Built into Playwright, zero extra deps |
| Multi-browser execution | Separate shell scripts per browser | `projects` array in `playwright.config.ts` | Parallel execution, shared config |
| Screenshot diffing | Manual image comparison | `expect(page).toHaveScreenshot()` | Built-in, auto-managed baseline images |
| Auth persistence across tests | Custom cookie serialization | `storageState` + `context.addCookies()` | Playwright-native pattern |

---

## Common Pitfalls

### Pitfall 1: Server-Side Supabase Calls Cannot Be Intercepted by Playwright

**What goes wrong:** The leaderboard page (`/leaderboards`) and marketplace browse (`/marketplace/browse`) are Next.js Server Components that call Supabase from the Next.js server process (Node.js). `page.route()` only intercepts browser-originated network requests, not server-side fetches. Tests navigate to these pages and see empty/error states because the server can't reach real Supabase (no env vars in CI or wrong credentials).

**Why it happens:** Playwright's network interception sits in the browser process. RSC data fetching happens in Node.js, outside Playwright's reach.

**How to avoid:** Two strategies (choose per page):
1. **Strategy A — Test client-rendered paths:** For pages like the leaderboard explorer (client component `LeaderboardExplorer` receives props from server, but the server queries Supabase), navigate with query params that render a client-side state; or mock the API routes instead of direct Supabase calls.
2. **Strategy B — Set real env vars in `.env.test.local`:** Provide a Supabase URL + anon key pointing to a read-only test project. Violates "fully offline" constraint but is pragmatic.
3. **Strategy C (preferred for this project):** For the leaderboard, the `LeaderboardExplorer` client component receives model data via props from the server. If the server Supabase call returns empty (no real env vars), the page renders with empty arrays. Instead, **intercept the `/api/*` routes** that client components call via SWR hooks rather than the direct Supabase table endpoints. For server-rendered pages, accept that the shell renders but data may be empty — test the interactive client-side behavior (lens switching, sorting, pagination) by injecting props via `page.evaluate()` or using a test-specific API route.

> **Revised strategy:** For this project's architecture, the safest approach for server-rendered pages is to provide real (but read-only, rate-limited) `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars in CI. The dev server needs them anyway to start without crashing. Mark these as CI secrets. Then intercept the SWR API calls (e.g., `/api/rankings/*`) for client-side SWR components.

**Warning signs:** Empty tables on leaderboard, "No listings found" on marketplace browse in E2E, tests failing with network errors.

### Pitfall 2: Supabase Cookie Name is Project-Specific

**What goes wrong:** The `@supabase/ssr` package names cookies `sb-<project-ref>-auth-token` where `<project-ref>` is derived from `NEXT_PUBLIC_SUPABASE_URL`. A hardcoded cookie name in test helpers breaks if the URL changes.

**Why it happens:** The cookie name is computed at runtime from the project ref.

**How to avoid:** Intercept `/auth/v1/user` instead of (or in addition to) injecting cookies. The middleware's `getUser()` is what matters — if that endpoint returns a user, auth passes. The cookie injection is a belt-and-suspenders measure to avoid the initial redirect before the route handler fires.

**Warning signs:** Protected route tests redirect to `/login` even with mock auth set up.

### Pitfall 3: webServer timeout Too Short

**What goes wrong:** Next.js dev server takes 30-60 seconds to compile on first load in CI. With default `timeout: 30000`, Playwright times out waiting for `http://localhost:3000`.

**How to avoid:** Set `webServer.timeout: 120_000` (2 minutes). On CI, the first compilation is always slower.

**Warning signs:** `Error: Timed out waiting for http://localhost:3000 to respond` in CI logs.

### Pitfall 4: Missing .env.local for Dev Server

**What goes wrong:** `npm run dev` crashes immediately if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set. The webServer never comes up.

**How to avoid:** Add these as GitHub Actions secrets and export them in the `e2e` job's `env:` block. Alternatively, create a `.env.test` checked into the repo with a fake/read-only project URL.

**Warning signs:** `webServer` command exits with non-zero code before Playwright can connect.

### Pitfall 5: route.fulfill() Not Applied Before Navigation

**What goes wrong:** Tests call `page.goto('/protected-page')` before setting up the route intercept. The middleware's auth check fires before the route handler is registered, causing a redirect to `/login`.

**How to avoid:** Always register route handlers _before_ `page.goto()`. In `beforeEach`, set up all required routes, then navigate in the test body.

**Warning signs:** Intermittent "unexpected redirect" failures, especially on the first test run.

### Pitfall 6: Missing `--with-deps` in CI

**What goes wrong:** `npx playwright install chromium firefox` installs browser binaries but not the OS-level shared libraries they need (libnss3, libatk-bridge2.0-0, etc.). Tests fail with "cannot open display" or similar browser launch errors on ubuntu-latest.

**How to avoid:** Use `npx playwright install --with-deps chromium firefox` in CI. Locally, developers may already have dependencies; in CI the ubuntu-latest runner is clean.

---

## Code Examples

### playwright.config.ts (Full)
```typescript
// Source: https://playwright.dev/docs/test-configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'playwright-results',
  reporter: process.env.CI ? 'github' : 'html',
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### GitHub Actions e2e Job
```yaml
# Source: https://playwright.dev/docs/ci-intro
  e2e:
    name: E2E
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium firefox
      - name: Run E2E tests
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### Auth Route Interception (Core Helper)
```typescript
// Source: Playwright docs + Supabase SSR cookie pattern
// e2e/helpers/auth.ts
import type { BrowserContext } from '@playwright/test';

export async function injectMockAuth(context: BrowserContext): Promise<void> {
  // Intercept Supabase auth validation (what middleware calls)
  await context.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id-00000000-0000-0000-0000-000000000001',
        email: 'e2e-test@example.com',
        role: 'authenticated',
        aud: 'authenticated',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        user_metadata: { full_name: 'E2E Tester' },
        app_metadata: { provider: 'email' },
      }),
    });
  });

  // Intercept token refresh
  await context.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'test-user-id-00000000-0000-0000-0000-000000000001', email: 'e2e-test@example.com' },
      }),
    });
  });
}
```

### Login Form Test (E2E-02 core)
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('email login redirects to home and shows user indicator', async ({ page }) => {
    // Intercept the signInWithPassword call (POST /auth/v1/token?grant_type=password)
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: { id: 'test-user-id', email: 'test@example.com' },
        }),
      });
    });
    // Also intercept the subsequent getUser call on redirect
    await page.route('**/auth/v1/user**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-user-id', email: 'test@example.com', role: 'authenticated' }),
      });
    });

    await page.goto('/login');
    await page.fill('[aria-label="Email address"]', 'test@example.com');
    await page.fill('[aria-label="Password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Login form does router.push(redirectTo) then router.refresh()
    await expect(page).toHaveURL('/');
  });

  test('logout clears session and redirects to login', async ({ page, context }) => {
    const { injectMockAuth } = await import('./helpers/auth');
    await injectMockAuth(context);
    await page.goto('/');
    // Click avatar/user menu -> logout button
    // Assert redirect to /login or /
  });
});
```

### Leaderboard Lens Test (E2E-04 core)
```typescript
// e2e/leaderboard.spec.ts
import { test, expect } from '@playwright/test';
import leaderboardFixture from './fixtures/leaderboard.json';

test.describe('Leaderboard', () => {
  test('switching lens filter changes displayed models', async ({ page }) => {
    // The leaderboard page is server-rendered and passes explorerModels as props
    // to LeaderboardExplorer (client component). The interactive lens switching
    // is purely client-side (useState in LeaderboardExplorer).
    await page.goto('/leaderboards');

    // Default tab is 'Explorer'. Click to 'Explorer' tab if needed.
    const explorerTab = page.getByRole('tab', { name: 'Explorer' });
    await explorerTab.click();

    // LENS_TABS from leaderboard-controls.tsx: 'capability' | 'usage' | 'expert' | 'balanced'
    // Click Usage lens
    await page.getByRole('tab', { name: /usage/i }).click();
    // Verify URL or data attribute change, or that models re-sort
    // The lens switching is via UI buttons — assert the active lens changes
    // by checking a data attribute or button state
    await expect(page.getByRole('tab', { name: /usage/i })).toHaveAttribute('aria-selected', 'true');
  });
});
```

### Fixture Shape: leaderboard.json
```json
[
  {
    "name": "GPT-4o",
    "slug": "gpt-4o",
    "provider": "openai",
    "category": "chat",
    "overall_rank": 1,
    "category_rank": 1,
    "quality_score": 92.5,
    "value_score": 78.0,
    "is_open_weights": false,
    "hf_downloads": null,
    "popularity_score": 95.0,
    "agent_score": 88.0,
    "agent_rank": 1,
    "popularity_rank": 1,
    "market_cap_estimate": 5000000,
    "capability_score": 91.0,
    "capability_rank": 1,
    "usage_score": 89.0,
    "usage_rank": 2,
    "expert_score": 93.0,
    "expert_rank": 1,
    "balanced_rank": 1
  }
]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cypress for Next.js E2E | Playwright (official Next.js docs recommendation) | 2023-2024 | Better Next.js App Router support, built-in webServer |
| Real DB in E2E | `route.fulfill()` fixture interception | 2024 | Fully offline, deterministic tests |
| `actions/upload-artifact@v3` | `actions/upload-artifact@v4` | 2024 | v3 deprecated; v4 required in new workflows |
| `npx playwright install` | `npx playwright install --with-deps` | 2023 | Installs OS deps alongside browsers; required on ubuntu-latest |

**Playwright version note:** Current stable is 1.50+ (March 2026). The `@playwright/test` package includes the test runner — no separate `playwright-test` package needed. Use `devices` from `@playwright/test` for viewport presets.

---

## Open Questions

1. **Server-side RSC Supabase calls in leaderboard/marketplace**
   - What we know: `page.route()` cannot intercept Node.js-originated fetches from Next.js server components. The leaderboard page and marketplace browse are RSCs that call Supabase directly.
   - What's unclear: Whether the Next.js dev server started by `webServer` config will have valid `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars, and whether anonymous read access to the Supabase project is sufficient for the dev server to serve these pages with real data.
   - Recommendation: Provide real (anon-key) env vars via GitHub Actions secrets. The anon key gives read-only access to public data — leaderboard and marketplace data are public. This satisfies the spirit of "no real Supabase dependency" while making RSC tests work. Auth tests remain fully mocked.

2. **Supabase cookie name discovery**
   - What we know: The cookie name format is `sb-<project-ref>-auth-token`, where `project-ref` is parsed from `NEXT_PUBLIC_SUPABASE_URL` (e.g., `sb-abcdefghij-auth-token`).
   - What's unclear: Exact parsing logic in `@supabase/ssr` v0.8.x.
   - Recommendation: Use `context.route('**/auth/v1/user**', ...)` as the primary auth bypass mechanism rather than cookie injection. This is interceptable regardless of cookie name.

3. **LeaderboardExplorer test depth**
   - What we know: The lens switching and sort are purely client-side (`useState`, `@tanstack/react-table`). They don't make new API calls.
   - What's unclear: Whether the server renders meaningful data when Supabase env vars are real (and the RSC can fetch). If RSC data is empty, the client component gets an empty array and lens switching is a no-op.
   - Recommendation: Plan for the "real anon-key" approach (open question 1) to ensure RSC data exists, then test client-side interactions on top of real data.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.50+ |
| Config file | `playwright.config.ts` (Wave 0 — must be created) |
| Quick run command | `npx playwright test --project=chromium-desktop e2e/auth.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-01 | Playwright installed, webServer starts Next.js dev | smoke | `npx playwright test --project=chromium-desktop --grep "smoke"` | Wave 0 |
| E2E-02 | Auth: login form, session persistence, logout | e2e | `npx playwright test e2e/auth.spec.ts` | Wave 0 |
| E2E-03 | Model detail: scores display, tab navigation | e2e | `npx playwright test e2e/model-detail.spec.ts` | Wave 0 |
| E2E-04 | Leaderboard: lens filter, sort, pagination | e2e | `npx playwright test e2e/leaderboard.spec.ts` | Wave 0 |
| E2E-05 | Marketplace: search, filter, listing detail | e2e | `npx playwright test e2e/marketplace.spec.ts` | Wave 0 |
| E2E-06 | CI: e2e job in ci.yml passes | integration | CI pipeline (GitHub Actions) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=chromium-desktop <specific-spec.ts>`
- **Per wave merge:** `npx playwright test` (all browsers, all specs)
- **Phase gate:** Full suite green (all 3 projects) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `playwright.config.ts` — E2E-01 core config
- [ ] `e2e/fixtures/leaderboard.json` — shared fixture for E2E-04
- [ ] `e2e/fixtures/listings.json` — shared fixture for E2E-05
- [ ] `e2e/fixtures/models.json` — shared fixture for E2E-03
- [ ] `e2e/helpers/auth.ts` — `injectMockAuth()` helper for E2E-02
- [ ] `e2e/helpers/routes.ts` — `mockSupabaseTable()` helper for E2E-03/04/05
- [ ] `e2e/auth.spec.ts` — E2E-02
- [ ] `e2e/model-detail.spec.ts` — E2E-03
- [ ] `e2e/leaderboard.spec.ts` — E2E-04
- [ ] `e2e/marketplace.spec.ts` — E2E-05
- [ ] `.github/workflows/ci.yml` update — E2E-06
- [ ] `.gitignore` additions: `playwright-results/`, `playwright-report/`, `playwright/.auth/`
- [ ] Framework install: `npm install --save-dev @playwright/test` + `npx playwright install chromium firefox`

---

## Sources

### Primary (HIGH confidence)
- [Playwright Test Configuration](https://playwright.dev/docs/test-configuration) — `playwright.config.ts` structure, projects, retries, webServer, outputDir
- [Playwright Mock APIs](https://playwright.dev/docs/mock) — `route.fulfill()` pattern, glob URL matching, JSON responses
- [Playwright Auth](https://playwright.dev/docs/auth) — `storageState`, `context.addCookies()`, authentication patterns
- [Playwright CI Intro](https://playwright.dev/docs/ci-intro) — GitHub Actions workflow, browser install, artifact upload
- [Next.js Playwright Guide](https://nextjs.org/docs/pages/guides/testing/playwright) — webServer config, Next.js-specific setup

### Secondary (MEDIUM confidence)
- [Michele Ong: Testing Next.js 15 + Playwright + MSW + Supabase](https://micheleong.com/blog/testing-with-nextjs-15-and-playwright-msw-and-supabase) — Supabase auth mocking with fake JWT + MSW interceptor for `/auth/v1/user`
- [BrowserStack: Mock APIs with Playwright](https://www.browserstack.com/guide/how-to-mock-api-with-playwright) — `route.fulfill()` patterns, fixture organization

### Tertiary (LOW confidence — verify via testing)
- Supabase cookie name format `sb-<ref>-auth-token` — inferred from `@supabase/ssr` source; verify in running dev server

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Playwright is the officially recommended E2E tool for Next.js; version verified via npm registry
- Architecture (Playwright config, route.fulfill): HIGH — Verified against official Playwright docs
- Supabase auth mocking via route interception: MEDIUM — Pattern verified conceptually; exact cookie name and middleware interaction needs empirical testing
- RSC server-side fetch limitation: HIGH — Well-documented Playwright behavior; cannot intercept Node.js-side fetches
- CI workflow structure: HIGH — Matches official Playwright CI docs + existing project's ci.yml pattern

**Research date:** 2026-03-10
**Valid until:** 2026-06-10 (Playwright releases monthly but config API is stable; Supabase SSR may change cookie format)
