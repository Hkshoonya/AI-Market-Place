---
phase: 09-observability
plan: 02
subsystem: analytics
tags: [posthog, analytics, pageview, user-identification, event-tracking]

requires:
  - phase: 09-observability-01
    provides: posthog-js installed, CSP headers configured for PostHog domains
provides:
  - PostHog provider with automatic pageview tracking on client-side navigation
  - User identification on sign-in and reset on sign-out
  - Typed analytics helper with 6 custom event methods
  - Custom event tracking at 5 interaction points
affects: [10-performance, 15-e2e-testing]

tech-stack:
  added: [posthog-js/react]
  patterns: [PostHogProvider wrapper, manual $pageview capture for App Router, client tracker component for server pages]

key-files:
  created:
    - src/app/providers.tsx
    - src/lib/posthog.ts
    - src/components/models/model-view-tracker.tsx
  modified:
    - src/app/layout.tsx
    - src/components/auth/auth-provider.tsx
    - src/app/(catalog)/models/[slug]/page.tsx
    - src/app/compare/compare-client.tsx
    - src/components/marketplace/view-tracker.tsx
    - src/components/marketplace/english-bid-panel.tsx
    - src/components/models/leaderboard-explorer.tsx

key-decisions:
  - "Manual pageview capture with capture_pageview:false for Next.js App Router compatibility"
  - "Graceful no-op when NEXT_PUBLIC_POSTHOG_KEY is unset (safe for local dev)"
  - "Client tracker component pattern for server-rendered pages needing PostHog events"

patterns-established:
  - "PHProvider wraps outside AuthProvider so PostHog initializes before auth events"
  - "ModelViewTracker pattern: small 'use client' component for firing analytics from server pages"
  - "analytics helper: typed wrapper over posthog.capture with snake_case event properties"

requirements-completed: [OBS-03, OBS-04]

duration: 4min
completed: 2026-03-05
---

# Phase 9 Plan 2: PostHog Analytics Summary

**PostHog product analytics with auto-pageviews, user identification, and 6 custom events across key interaction points**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T06:40:02Z
- **Completed:** 2026-03-05T06:43:44Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- PostHog provider initializes on client side with manual pageview tracking for App Router
- Every client-side navigation fires a $pageview event via usePathname/useSearchParams
- Logged-in users identified with posthog.identify; sign-out calls posthog.reset
- 6 custom events (model_viewed, model_compared, listing_viewed, auction_bid, lens_switched, search_performed) fire at their interaction points
- Graceful no-op when NEXT_PUBLIC_POSTHOG_KEY is not set

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PostHog provider, analytics helper, and wire into layout** - `c67a07a` (feat)
2. **Task 2: Add custom event tracking to key interaction points** - `c3dad11` (feat)

## Files Created/Modified
- `src/app/providers.tsx` - PHProvider with PostHogPageView component for manual pageview capture
- `src/lib/posthog.ts` - Typed analytics helper with 6 event methods
- `src/components/models/model-view-tracker.tsx` - Client component to track model views from server page
- `src/app/layout.tsx` - PHProvider wrapping AuthProvider in root layout
- `src/components/auth/auth-provider.tsx` - posthog.identify on sign-in, posthog.reset on sign-out
- `src/app/(catalog)/models/[slug]/page.tsx` - ModelViewTracker rendered on model detail page
- `src/app/compare/compare-client.tsx` - model_compared event when 2+ models loaded
- `src/components/marketplace/view-tracker.tsx` - listing_viewed event alongside existing RPC counter
- `src/components/marketplace/english-bid-panel.tsx` - auction_bid event after successful bid
- `src/components/models/leaderboard-explorer.tsx` - lens_switched and search_performed events

## Decisions Made
- Manual pageview capture (capture_pageview: false) required for Next.js App Router where automatic tracking misses client-side navigations
- PHProvider wraps outside AuthProvider so PostHog is initialized before auth state change events fire
- Created ModelViewTracker client component pattern since the model detail page is a server component that cannot use PostHog directly
- search_performed only fires when query is 3+ characters to avoid noise from partial typing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
NEXT_PUBLIC_POSTHOG_KEY environment variable must be set in production (Coolify build args) for PostHog to activate. Without it, the provider renders children without PostHog (graceful no-op).

## Next Phase Readiness
- Observability phase complete: Sentry (Plan 01) + PostHog (Plan 02) both integrated
- Ready for Phase 10 (Performance) or any subsequent phase

---
*Phase: 09-observability*
*Completed: 2026-03-05*
