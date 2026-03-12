---
phase: 22-railway-deployment
plan: 01
subsystem: api
tags: [health-endpoint, domain, middleware, zod, vitest, tdd]

# Dependency graph
requires:
  - phase: 21-admin-visibility
    provides: pipeline-health-compute shared lib (computeStatus used in health route)
  - phase: 20-pipeline-hardening
    provides: pipeline_health table, data_sources table, createAdminClient pattern
provides:
  - /api/health endpoint with public (status/version/timestamp) and authenticated (full detail) tiers
  - setCronStatus/getCronStatus exports for Plan 02 cron wiring
  - www -> apex 301 redirect in middleware
  - Zero aimarketcap.com references in src/ (all updated to aimarketcap.tech)
affects:
  - 22-02 (custom-server.js calls setCronStatus to populate cron field)
  - monitoring/uptime tools (consume /api/health for status checks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pingDb() helper pattern — DB check returns NextResponse on failure OR typed result object on success, avoiding TypeScript null inference issues with try/catch split
    - Two-tier health response — public returns minimal status; Bearer CRON_SECRET returns full operational detail
    - Module-level cron status state — setter/getter exports allow custom-server.js to populate without circular imports

key-files:
  created:
    - src/app/api/health/route.ts
    - src/app/api/health/__tests__/route.test.ts
  modified:
    - src/middleware.ts
    - src/lib/env.ts
    - .env.example
    - src/app/(static)/api-docs/api-docs-content.tsx
    - src/app/(static)/contact/contact-content.tsx
    - src/app/(static)/terms/page.tsx
    - src/app/(static)/privacy/page.tsx
    - src/lib/data-sources/adapters/openrouter-models.ts
    - .planning/PROJECT.md

key-decisions:
  - "pingDb() extracts DB check into helper returning NextResponse|result to avoid TypeScript non-null assertion with split try/catch blocks"
  - "503 returned ONLY for DB unreachable; degraded pipeline returns 200 with status: 'degraded'"
  - "setCronStatus/getCronStatus module exports — Plan 02 wires real cron values; Plan 01 ships stub returning false/0"
  - "www redirect uses request.nextUrl.clone() + protocol=https + 301 — placed before Supabase session refresh"

patterns-established:
  - "Health endpoint pattern: public minimal / authenticated full detail / DB fail 503"
  - "Domain: aimarketcap.tech is canonical — all HTTP-Referer, URLs, emails use .tech"

requirements-completed: [DEPL-05, DEPL-04]

# Metrics
duration: 25min
completed: 2026-03-12
---

# Phase 22 Plan 01: Health Endpoint and Domain Migration Summary

**/api/health endpoint with public/authenticated tiers and 503 on DB failure; zero aimarketcap.com references in src/ (fully migrated to aimarketcap.tech); www->apex 301 redirect in middleware**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-12T00:50:00Z
- **Completed:** 2026-03-12T01:05:00Z
- **Tasks:** 2 (+ 1 auto-fix refactor)
- **Files modified:** 10

## Accomplishments

- Created `/api/health` route with Zod-validated two-tier response (public: status/version/timestamp; authed: +database/uptime/cron/pipeline counts)
- DB unreachable returns 503 `{ status: "unhealthy", error }` — all other degradation returns 200 with `status: "degraded"`
- Replaced all `aimarketcap.com` references in src/ with `aimarketcap.tech` (env.ts, api-docs, contact, terms, privacy, openrouter adapter)
- Added www-to-apex 301 redirect in middleware before Supabase session handling
- 10 TDD tests passing covering public, authenticated, DB failure, and version field scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/health endpoint (RED)** - `71fdb3b` (feat)
2. **Task 1: Refactor — pingDb() helper for TypeScript correctness** - `9120349` (fix)
3. **Task 2: Update domain references and www redirect** - `6f320f5` (feat)

## Files Created/Modified

- `src/app/api/health/route.ts` — Health endpoint: public/auth tiers, DB ping, pipeline summary, cron status stubs
- `src/app/api/health/__tests__/route.test.ts` — 10 TDD tests covering all response tiers and error handling
- `src/middleware.ts` — Added www->apex 301 redirect before Supabase auth logic
- `src/lib/env.ts` — NEXT_PUBLIC_SITE_URL fallback updated to aimarketcap.tech
- `.env.example` — Comment updated to aimarketcap.tech
- `src/app/(static)/api-docs/api-docs-content.tsx` — Base URL and curl examples updated
- `src/app/(static)/contact/contact-content.tsx` — Support email updated to @aimarketcap.tech
- `src/app/(static)/terms/page.tsx` — All 4 email references updated
- `src/app/(static)/privacy/page.tsx` — All 10 email references updated
- `src/lib/data-sources/adapters/openrouter-models.ts` — HTTP-Referer updated in sync() and healthCheck()
- `.planning/PROJECT.md` — Domain reference updated

## Decisions Made

- **pingDb() helper pattern:** DB check extracted into helper that returns `NextResponse` on failure or `{ supabase, latencyMs }` on success — avoids TypeScript null inference issue with split try/catch blocks and eliminates non-null assertion.
- **503 only for DB unreachable:** Degraded pipeline or missing cron returns 200 `degraded`; only DB connectivity failure returns 503. This matches monitoring tool expectations.
- **Cron status stubs:** `setCronStatus`/`getCronStatus` exported as module-level state. Plan 02 (custom-server.js) calls `setCronStatus(true, count)` after starting node-cron jobs. Plan 01 ships returning `{ active: false, jobCount: 0 }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refactored DB ping try/catch to avoid TypeScript null inference**
- **Found during:** Task 1 (after GREEN tests passed, lint check)
- **Issue:** `let supabase; try { supabase = ... } catch { return 503 }` — TypeScript doesn't infer `supabase` is non-null after catch-returns, requiring either `!` assertion or `| null` type. The eslint-disable for prefer-const was also a lint violation.
- **Fix:** Extracted DB ping into `pingDb()` helper function that returns `NextResponse | { supabase, latencyMs }` — TypeScript correctly narrows the type after the instanceof check.
- **Files modified:** `src/app/api/health/route.ts`
- **Verification:** All 10 tests still pass; `npx eslint src/app/api/health/route.ts` → zero warnings
- **Committed in:** `9120349` (fix commit between Task 1 and Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/TypeScript correctness)
**Impact on plan:** TypeScript correctness fix, no scope creep, zero test regression.

## Issues Encountered

- Pre-existing lint errors in `server/custom-server.js` (require() imports), `src/app/api/admin/sync/route.test.ts` (prefer-const), and `src/lib/data-sources/orchestrator.test.ts` (unused vars) are out of scope and documented in `deferred-items.md`. These prevent `npm run lint` from passing clean across the full project but are not caused by this plan.

## Next Phase Readiness

- `/api/health` ready for Plan 02 to wire real cron status via `setCronStatus`
- Domain canonical across all source files — no further aimarketcap.com cleanup needed
- www redirect active in middleware — single canonical URL enforced

---
*Phase: 22-railway-deployment*
*Completed: 2026-03-12*

## Self-Check: PASSED

- src/app/api/health/route.ts: FOUND
- src/app/api/health/__tests__/route.test.ts: FOUND
- .planning/phases/22-railway-deployment/22-01-SUMMARY.md: FOUND
- Commit 71fdb3b: FOUND
- Commit 9120349: FOUND
- Commit 6f320f5: FOUND
