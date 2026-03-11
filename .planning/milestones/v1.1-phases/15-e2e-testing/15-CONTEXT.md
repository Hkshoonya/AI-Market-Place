# Phase 15: E2E Testing - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Playwright tests for critical user journeys (auth, model detail, leaderboard, marketplace) integrated into CI as a required check. No new features — this phase adds test infrastructure and test coverage for existing functionality.

</domain>

<decisions>
## Implementation Decisions

### Auth & data strategy
- Mock auth at browser level — inject Supabase session cookies/tokens directly into browser context
- One dedicated auth flow test verifies the login UI, but even that uses intercepted routes (fully offline)
- All test data provided via Playwright route.fulfill() intercepting API/Supabase calls with fixture JSON
- Shared fixtures directory (`e2e/fixtures/`) with JSON files (models.json, leaderboard.json, listings.json, etc.) reused across tests
- No real Supabase dependency — tests run fully offline

### Test depth per journey
- **Auth flow:** Full form interaction — fill email + password, submit, verify redirect to dashboard, check session indicator (avatar/name in header), test logout clears session
- **Model detail:** Navigate to model page, verify scores display, click through tabs (overview, benchmarks, pricing, etc.), verify each tab renders content
- **Leaderboard:** Load leaderboard, switch between Capability/Usage/Expert/Balanced lenses and verify models change, click sort column and verify reorder, navigate to page 2
- **Marketplace:** Search for a listing, apply category/price filters, verify results narrow, click a listing, verify detail page shows title/description/price

### CI integration
- Separate 'e2e' job in ci.yml alongside existing lint/typecheck/test jobs (runs in parallel)
- Dev server started via Playwright's built-in webServer config (`npm run dev`, wait for port)
- E2E is a required status check — PR cannot merge if Playwright fails
- Upload screenshots + trace files as GitHub Actions artifacts on test failure only

### Test environment
- Browsers: Chromium + Firefox (two browsers for broader coverage)
- Test files live in top-level `e2e/` directory with `*.spec.ts` files
- Viewports: Desktop (1280x720) + mobile (375x667) — both tested
- Retries: `retries: process.env.CI ? 1 : 0` — 1 retry in CI only, none locally

### Claude's Discretion
- Playwright config structure and helper utilities
- Fixture data shapes and exact mock responses
- Test file organization within e2e/ directory
- Exact selectors and assertion patterns
- webServer timeout and port configuration

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard Playwright approaches for Next.js apps.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- CI workflow (`.github/workflows/ci.yml`): Existing lint/typecheck/test jobs to model E2E job after
- Vitest config (`vitest.config.mts`): 4 projects pattern shows how tests are organized
- Component test setup (`setup-component.ts`): Next.js mocking patterns may inform E2E approach

### Established Patterns
- GitHub Actions with Node 24, npm ci, concurrency groups — E2E job should follow same pattern
- Supabase auth via middleware protecting `(auth)/` routes — mock must satisfy middleware checks
- SWR data fetching with tiered refresh — route interception must cover SWR API calls

### Integration Points
- CI pipeline: New 'e2e' job added to `.github/workflows/ci.yml`
- package.json: New `test:e2e` script, Playwright in devDependencies
- .gitignore: Playwright test results, report directories
- Route groups: `(auth)/`, `(catalog)/`, `(rankings)/`, `(marketplace)/` define the test targets

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-e2e-testing*
*Context gathered: 2026-03-10*
