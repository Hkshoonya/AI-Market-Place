---
phase: 18-e2e-model-detail-ci-fixture
plan: 01
subsystem: testing
tags: [msw, playwright, e2e, supabase, next.js, instrumentation]

# Dependency graph
requires:
  - phase: 15-e2e-testing
    provides: Playwright infrastructure, E2E test helpers, existing model-detail.spec.ts skeleton
provides:
  - MSW server-side HTTP interception via instrumentation.ts for E2E tests
  - Real production fixture data for deepseek-r1 model (benchmark_scores, model_pricing, elo_ratings)
  - Model detail page E2E tests without test.skip() patterns, passing in CI
affects: [ci, e2e-testing, model-detail-page, future-e2e-spec-authors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MSW instrumentation.ts pattern: conditionally start server.listen() inside register() when NEXT_PUBLIC_E2E_MSW=true
    - PostgREST single vs list disambiguation via slug query param (eq. prefix check)
    - CSP E2E exception: extend connect-src to allow http/ws localhost:54321 when NEXT_PUBLIC_E2E_MSW=true

key-files:
  created:
    - e2e/mocks/handlers.ts
    - e2e/mocks/server.ts
    - e2e/fixtures/model-detail.json
  modified:
    - src/instrumentation.ts
    - playwright.config.ts
    - .github/workflows/ci.yml
    - e2e/model-detail.spec.ts
    - next.config.ts

key-decisions:
  - "Use DeepSeek-R1 (not GPT-4o) as fixture model — GPT-4o absent from production DB"
  - "MSW runs inside Next.js process via instrumentation.ts, not Playwright process — intercepts SSR Supabase calls"
  - "onUnhandledRequest: bypass in server.listen() — avoids noise from auth, Sentry, PostHog requests"
  - "CSP extended for localhost:54321 when NEXT_PUBLIC_E2E_MSW=true to prevent browser security violations"
  - "Pricing tab assertion uses $/M column header text (actual rendered text) not 'per million'"

patterns-established:
  - "MSW E2E pattern: handlers.ts + server.ts + instrumentation.ts guard + NEXT_PUBLIC_E2E_MSW env var"
  - "Fixture mock completeness: SWR description endpoint requires all ModelDescriptionData fields (pros/cons arrays) to prevent TypeError"

requirements-completed: [E2E-03]

# Metrics
duration: ~120min
completed: 2026-03-11
---

# Phase 18 Plan 01: E2E Model Detail CI Fixture Summary

**MSW server-side interception via instrumentation.ts eliminates test.skip() from model-detail E2E — all 3 tests run and pass across 3 Playwright projects using real DeepSeek-R1 production data**

## Performance

- **Duration:** ~120 min
- **Started:** 2026-03-11T14:00:00Z
- **Completed:** 2026-03-11T15:58:24Z
- **Tasks:** 2
- **Files modified:** 7 (created: 3, modified: 4)

## Accomplishments
- MSW infrastructure (`handlers.ts`, `server.ts`) wired into `instrumentation.ts` — intercepts server-side PostgREST calls during E2E so model detail page renders with fixture data instead of 404
- Real DeepSeek-R1 production fixture data extracted from live Supabase DB (benchmark_scores, model_pricing, elo_ratings, snapshots)
- All 3 model-detail.spec.ts tests pass across chromium-desktop, firefox-desktop, chromium-mobile — zero `test.skip()` patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MSW infrastructure, fixture data, wire into instrumentation.ts** - `c896c10` (feat)
2. **Task 2: Rewrite model-detail.spec.ts, fix CSP and description mock** - `acad728` (feat)

## Files Created/Modified
- `e2e/mocks/handlers.ts` - MSW HTTP handlers for PostgREST URL patterns (models, model_snapshots, model_news, auth)
- `e2e/mocks/server.ts` - Thin setupServer wrapper exporting `server`
- `e2e/fixtures/model-detail.json` - Real production data: DeepSeek-R1 with 13 benchmark_scores, 2 pricing entries, 4 elo_ratings, 5 snapshots, 2 similar_models
- `src/instrumentation.ts` - Conditional MSW activation: `if (NEXT_PUBLIC_E2E_MSW === "true") server.listen({ onUnhandledRequest: "bypass" })`
- `playwright.config.ts` - Added `NEXT_PUBLIC_E2E_MSW: "true"` to webServer.env
- `.github/workflows/ci.yml` - Added `NEXT_PUBLIC_E2E_MSW: 'true'` to e2e job env block
- `e2e/model-detail.spec.ts` - All 3 tests rewritten without test.skip(); client-side SWR mocks included
- `next.config.ts` - CSP relaxed for E2E mode: connect-src extended to allow http/ws localhost:54321

## Decisions Made
- **DeepSeek-R1 instead of GPT-4o**: GPT-4o absent from production DB; DeepSeek-R1 is a well-populated model with benchmark_scores, pricing, and ranking data
- **MSW runs in Next.js process**: Only instrumentation.ts can intercept server-side RSC Supabase calls; Playwright globalSetup cannot
- **CSP E2E exception**: Without allowing localhost:54321, the browser-side Supabase client fires CSP violations that trigger React error boundary for the entire catalog route group
- **`onUnhandledRequest: "bypass"`**: Prevents noise warnings from auth (Supabase JWT verification), Sentry, and PostHog requests that have no handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ModelOverview TypeError from incomplete description mock**
- **Found during:** Task 2 (test execution)
- **Issue:** SWR mock for `/api/models/*/description` returned `{ description, generated_at }` but `ModelOverview` component expects `{ summary, pros, cons, best_for, not_ideal_for, comparison_notes, generated_by, upvotes, downvotes }`. Missing `pros`/`cons` arrays caused `TypeError: Cannot read properties of undefined (reading 'length')` which triggered the React error boundary for all 3 tests
- **Fix:** Updated mock response to include all required fields with empty arrays for pros/cons/best_for/not_ideal_for
- **Files modified:** `e2e/model-detail.spec.ts`
- **Verification:** Error boundary no longer shown; all 3 tests pass
- **Committed in:** acad728 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Pricing tab assertion against non-existent text**
- **Found during:** Task 2 (test execution after error boundary fixed)
- **Issue:** Test 2 asserted `page.getByText(/per million/i)` in Pricing tab but `PricingTab` renders `Input $/M` / `Output $/M` column headers — "per million" text does not appear in the DOM
- **Fix:** Changed assertion to `page.getByText(/\$\/M/i)` to match actual rendered column header text
- **Files modified:** `e2e/model-detail.spec.ts`
- **Verification:** Test 2 passes, Pricing tab assertion succeeds
- **Committed in:** acad728 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added CSP E2E exception in next.config.ts**
- **Found during:** Task 2 (debugging error boundary root cause)
- **Issue:** Plan did not include CSP modification. Browser-side Supabase calls to `http://localhost:54321` violated CSP `connect-src` policy (only allowed `*.supabase.co`), causing React error boundary activation
- **Fix:** Extended CSP `connect-src` to include `http://localhost:54321 ws://localhost:54321` when `NEXT_PUBLIC_E2E_MSW=true`
- **Files modified:** `next.config.ts`
- **Verification:** Browser no longer shows CSP violations; error boundary no longer triggered
- **Committed in:** acad728 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correctness. The CSP deviation was a missing prerequisite for the tests to work. The mock shape bug and assertion text bug were minor plan specification gaps.

## Issues Encountered
- **GPT-4o not in production DB**: Plan specified GPT-4o as fixture model; DeepSeek-R1 used instead (per plan's own fallback instruction: "if gpt-4o does not exist, query another well-known model")
- **Windows `/dev/stdin` incompatibility**: Fixture extraction scripts used `/dev/stdin` pipe which doesn't exist on Windows; fixed by writing temp `.mjs` files for multi-step node operations

## Next Phase Readiness
- Model detail E2E tests are now fully automated in CI with real fixture data
- MSW instrumentation pattern is established and can be extended to other pages (leaderboard, models list) using the same `handlers.ts` + `NEXT_PUBLIC_E2E_MSW` pattern
- The `auth.spec.ts` form-submission-error test has a pre-existing failure (empty error message text) not introduced by this plan

---
*Phase: 18-e2e-model-detail-ci-fixture*
*Completed: 2026-03-11*
