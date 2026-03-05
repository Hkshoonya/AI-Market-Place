# Phase 9: Observability - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate Sentry error tracking and PostHog product analytics into the platform. Update CSP headers, instrument error boundaries, add custom event tracking, upload source maps during Docker build. No performance monitoring (Sentry tracing) or session replay.

</domain>

<decisions>
## Implementation Decisions

### Sentry Integration
- Errors only, no performance tracing — add tracing later if needed
- Instrument handleApiError in src/lib/api-error.ts — single change covers all 68 API routes
- Instrument all 13 error.tsx files — replace console.error with Sentry.captureException
- Upload source maps during Docker build Stage 2 (builder) — requires SENTRY_AUTH_TOKEN as build arg in Coolify
- Include setup guide for creating Sentry project and configuring DSN as env var

### PostHog Events
- Key actions only (5-10 high-value events): model_viewed, model_compared, listing_viewed, auction_bid, lens_switched, search_performed
- US cloud region (us.posthog.com) — default, lower latency
- Identify logged-in users via posthog.identify(userId) after auth — links pre/post-login sessions
- No session replay — keep bundle lean
- Auto-capture page views with capture_pageview: false for App Router (manual pageview tracking needed)

### Error Classification
- Only capture 5xx (unexpected) errors to Sentry — 4xx are expected and would create noise
- Tag errors with: source route name + authenticated user ID (if available)
- No request body or query params in Sentry context (PII risk)

### Bundle Strategy
- Eager load both SDKs — 55-70KB gzipped is trivial next to existing three.js (~600KB)
- No lazy loading needed; errors captured from first render
- Tree-shake aggressively (no replay, no tracing modules)

### Claude's Discretion
- Bundle size monitoring approach (manual check vs documented baseline)
- Exact PostHog event property schemas
- Sentry environment/release tag naming convention
- Whether to add a PostHog opt-out mechanism (cookie banner)

</decisions>

<specifics>
## Specific Ideas

- handleApiError is THE integration point — one Sentry.captureException() call instruments 68 routes
- PostHog provider goes in layout.tsx above AuthProvider
- Sentry's withSentryConfig() wraps next.config.ts
- CSP needs: connect-src additions for *.ingest.sentry.io and us.i.posthog.com

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/api-error.ts` (handleApiError): Single point for server-side error capture — add Sentry.captureException here
- `src/lib/logging.ts` (createTaggedLogger, systemLog): Structured logging already in place — Sentry supplements, doesn't replace
- 13 `error.tsx` files: Client-side error boundaries all use same console.error pattern — systematic replacement
- `src/components/marketplace/view-tracker.tsx`: Pattern for client-side event tracking (useEffect + fire-and-forget)

### Established Patterns
- Provider wrapping in layout.tsx: AuthProvider > TooltipProvider — PostHog provider slots above AuthProvider
- next.config.ts: CSP headers defined in headers() function — straightforward domain additions
- Dockerfile multi-stage: Stage 2 (builder) runs npm run build — source map upload goes here

### Integration Points
- `next.config.ts`: withSentryConfig() wrapper + CSP header updates
- `src/app/layout.tsx`: PostHog provider component
- `src/lib/api-error.ts`: Sentry.captureException in handleApiError (5xx only)
- 13 error.tsx files: Sentry.captureException replacing console.error
- `Dockerfile` Stage 2: Sentry CLI source map upload after build
- `src/components/auth/auth-provider.tsx`: PostHog identify call after auth state change

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-observability*
*Context gathered: 2026-03-05*
