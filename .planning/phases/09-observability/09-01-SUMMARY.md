---
phase: 09-observability
plan: 01
subsystem: infra
tags: [sentry, posthog, error-tracking, csp, source-maps, observability]

requires:
  - phase: 05-infrastructure
    provides: "Dockerfile, next.config.ts, error boundaries, handleApiError"
provides:
  - "Sentry error capture on server, edge, and client runtimes"
  - "CSP headers pre-configured for both Sentry and PostHog"
  - "Source map upload via Docker build arg"
  - "posthog-js installed and ready for Plan 02"
affects: [09-observability, 10-deployment]

tech-stack:
  added: ["@sentry/nextjs", "posthog-js"]
  patterns: ["Sentry.captureException in error boundaries", "withSentryConfig wrapper", "instrumentation.ts for SDK init"]

key-files:
  created:
    - src/instrumentation.ts
    - src/instrumentation-client.ts
    - sentry.server.config.ts
    - sentry.edge.config.ts
  modified:
    - src/lib/api-error.ts
    - next.config.ts
    - Dockerfile
    - src/app/global-error.tsx
    - src/app/error.tsx
    - src/app/(admin)/error.tsx
    - src/app/(auth)/error.tsx
    - src/app/(auth)/orders/[id]/error.tsx
    - src/app/(catalog)/error.tsx
    - src/app/(marketplace)/dashboard/error.tsx
    - src/app/(marketplace)/dashboard/seller/error.tsx
    - src/app/(marketplace)/dashboard/seller/listings/[slug]/error.tsx
    - src/app/(marketplace)/error.tsx
    - src/app/(rankings)/error.tsx
    - src/app/(static)/about/error.tsx
    - src/app/(static)/error.tsx
    - src/app/(static)/privacy/error.tsx

key-decisions:
  - "Errors-only mode: tracesSampleRate=0, no replay, no tracing integrations to minimize bundle"
  - "Only 5xx errors sent to Sentry from handleApiError; 4xx ApiErrors are expected noise"
  - "No PII in Sentry context: no request body or query params attached"
  - "PostHog CSP pre-configured now to avoid a second CSP update in Plan 02"

patterns-established:
  - "Sentry.captureException(error) in all error.tsx useEffect hooks"
  - "Sentry.captureException(error, { tags: { source } }) in handleApiError for 5xx"
  - "instrumentation.ts with dynamic import for runtime-specific Sentry config"

requirements-completed: [OBS-01, OBS-02, OBS-05, PERF-03]

duration: 4min
completed: 2026-03-05
---

# Phase 9 Plan 1: Sentry Integration Summary

**Sentry error tracking across server/edge/client with source map upload, CSP for Sentry+PostHog, and tree-shaken errors-only config**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T06:32:28Z
- **Completed:** 2026-03-05T06:36:50Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Sentry SDK captures all unexpected 5xx server errors via handleApiError with source tag
- All 13 error boundaries + global-error.tsx send client exceptions to Sentry
- Source maps configured for upload during Docker build via SENTRY_AUTH_TOKEN build arg
- CSP headers allow both Sentry and PostHog domains (PostHog pre-configured for Plan 02)
- Bundle size controlled: tracing excluded, debug statements excluded, no replay

## Task Commits

Each task was committed atomically:

1. **Task 1: Install SDKs and create Sentry config files** - `ffbbb6d` (feat)
2. **Task 2: Instrument error handlers, update next.config.ts, CSP, Dockerfile, and all error boundaries** - `cbdcab3` (feat)

## Files Created/Modified
- `src/instrumentation.ts` - Server/edge Sentry registration with onRequestError
- `src/instrumentation-client.ts` - Client-side Sentry.init (errors only)
- `sentry.server.config.ts` - Server runtime Sentry config
- `sentry.edge.config.ts` - Edge runtime Sentry config
- `src/lib/api-error.ts` - Added Sentry.captureException for 5xx errors
- `next.config.ts` - withSentryConfig wrapper, CSP for Sentry+PostHog
- `Dockerfile` - SENTRY_AUTH_TOKEN build arg for source map upload
- `src/app/global-error.tsx` - Added Sentry.captureException
- `src/app/error.tsx` + 12 route group error.tsx files - Replaced console.error with Sentry.captureException

## Decisions Made
- Errors-only mode (tracesSampleRate=0) to minimize bundle and cost
- 4xx ApiErrors excluded from Sentry to reduce noise
- No PII attached to Sentry context (no request body/query params)
- PostHog CSP domains pre-configured to avoid future CSP update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Environment variables needed for Sentry to function:
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry project DSN (client + server)
- `SENTRY_ORG` - Sentry organization slug (build-time, for source maps)
- `SENTRY_PROJECT` - Sentry project slug (build-time, for source maps)
- `SENTRY_AUTH_TOKEN` - Sentry auth token (build-time, for source map upload via Coolify build args)

## Next Phase Readiness
- Sentry foundation complete, ready for PostHog analytics in Plan 02
- posthog-js already installed, CSP already configured
- Production deployment will need SENTRY_AUTH_TOKEN in Coolify build args

---
*Phase: 09-observability*
*Completed: 2026-03-05*
