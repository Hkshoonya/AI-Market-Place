---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Production Readiness
status: executing
stopped_at: Completed 13-04-PLAN.md (Phase 13 complete)
last_updated: "2026-03-09T04:24:41Z"
last_activity: 2026-03-09 — Completed Plan 13-04 (Ranking weight controls + leaderboard decomposition)
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Most comprehensive, multi-lens ranking of AI models
**Current focus:** Phase 13 - Component Decomposition & React.memo -- COMPLETE

## Current Position

Phase: 13 of 16 (Component Decomposition & React.memo) -- COMPLETE
Plan: 4 of 4 in current phase (complete)
Status: Phase complete
Last activity: 2026-03-09 — Completed Plan 13-04 (Ranking weight controls + leaderboard decomposition)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 28 (v1.0) + 15 (v1.1)
- Average duration: ~25 min (v1.0)
- Total execution time: ~12 hours (v1.0)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 09-observability | 01 | 4min | 2 | 21 |
| 09-observability | 02 | 4min | 2 | 10 |
| 10-ci-pipeline | 01 | 6min | 1 | 11 |
| 11-zod-runtime-validation | 01 | 6min | 2 | 9 |
| 11-zod-runtime-validation | 02 | 15min | 2 | 28 |
| 11-zod-runtime-validation | 03 | 11min | 2 | 11 |
| 11-zod-runtime-validation | 04 | 6min | 1 | 7 |
| 11-zod-runtime-validation | 05 | 9min | 1 | 4 |
| 12-component-testing-infrastructure | 01 | 5min | 2 | 4 |
| 12-component-testing-infrastructure | 02 | 4min | 2 | 3 |
| 12-component-testing-infrastructure | 03 | 8min | 2 | 2 |
| 13-component-decomposition-react-memo | 01 | 13min | 2 | 16 |
| 13-component-decomposition-react-memo | 02 | 5min | 2 | 8 |
| 13-component-decomposition-react-memo | 03 | 12min | 2 | 8 |
| 13-component-decomposition-react-memo | 04 | 7min | 2 | 5 |

**By Phase:** See `.planning/milestones/v1.0-ROADMAP.md` for v1.0 metrics.

## Accumulated Context

### Decisions

All v1.0 decisions archived in `.planning/milestones/v1.0-ROADMAP.md`.
Key patterns established:
- handleApiError + createTaggedLogger for error/logging
- TypedSupabaseClient for Supabase type safety
- createAdapterSyncer + buildRecord for adapter code reuse
- Custom hooks for component state extraction

v1.1 decisions:
- Sentry errors-only mode (tracesSampleRate=0, no replay) to minimize bundle
- 4xx ApiErrors excluded from Sentry to reduce noise
- PostHog CSP pre-configured in Plan 01 to avoid future update
- Manual pageview capture (capture_pageview: false) for App Router compatibility
- PHProvider wraps outside AuthProvider so PostHog initializes before auth events
- Client tracker component pattern for server-rendered pages needing PostHog events
- [Phase 10-ci-pipeline]: Downgraded React compiler ESLint rules to warnings for CI baseline
- [Phase 11-zod]: ExplorerModelSchema as standalone z.object() since category_rank not in base schema
- [Phase 11-zod]: reportSchemaError kept module-private, not exported from parse.ts
- [Phase 11-zod]: parseQueryResult pattern wraps Supabase {data,error} + z.array().safeParse() + Sentry reporting
- [Phase 11-zod]: Client two-query enrichment: validate raw data with base schema, enrich with profiles in JS
- [Phase 11-zod]: Recharts Payload<number, string> import for tooltip typing; single `as` for Scatter onClick
- [Phase 11-zod]: Passthrough schemas for dynamic embedded joins where FK relationships missing from DB types
- [Phase 11-zod]: Inline Zod schemas at query sites for one-off shapes rather than bloating central schema files
- [Phase 11-zod]: z.coerce.number() globally for all Postgres numeric/bigint columns (PostgREST returns strings)
- [Phase 11-zod]: is_open_weights z.boolean().nullable() since DB has DEFAULT false but no NOT NULL constraint
- [Phase 11-zod]: Two-query enrichment in orders client components; API route for buyer role lacks seller profile enrichment
- [Phase 11-zod]: OrderWithListingSchema replaces both OrderWithJoinsSchema and OrderWithPartiesSchema
- [Phase 12-testing]: passWithNoTests is a NonProjectOption in Vitest 4 - must be at root test level
- [Phase 12-testing]: React.createElement in setup mocks to keep .ts extension
- [Phase 12-testing]: Mock lucide-react icons to simple spans for jsdom test isolation
- [Phase 12-testing]: Mutable mockSearchParams variable pattern for per-test URL state override
- [Phase 12-testing]: vi.stubGlobal('fetch') pattern for API-calling component tests
- [Phase 12-testing]: vi.hoisted() for mock variables used inside vi.mock factory functions (Vitest 4 hoisting)
- [Phase 12-testing]: Chainable Supabase mock with .then() for thenable PostgREST query builder pattern
- [Phase 12-testing]: Mock radix-ui Tooltip as inline elements to avoid portal issues in jsdom
- [Phase 13-decomp]: compare-helpers.ts for shared types/helpers across page sub-components
- [Phase 13-decomp]: useMemo + React.memo pairing: stabilize array refs before passing to memo'd components
- [Phase 13-decomp]: ModelOption interface exported from model-selector.tsx, re-exported from parent
- [Phase 13-decomp]: Pure functions/types extracted to plain .ts (not .tsx) when no React dependency
- [Phase 13-decomp]: ScoreBar exported from leaderboard-table.tsx, imported in parent for column definitions
- [Phase 13-decomp]: Analytics callbacks as props to keep sub-components decoupled from analytics library
- [Phase 13-decomp]: LINE_COLORS exported from rank-timeline-tags.tsx, imported by parent for chart rendering
- [Phase 13-decomp]: PROVIDER_OPTIONS/PARAM_RANGES moved to filter-sheet-content.tsx; SORT_OPTIONS stays in parent
- [Phase 13-decomp]: import() type references inline for PricingEntry/UpdateEntry/EloRating sub-component props
- [Phase 13-decomp]: NotifPrefs interface moved into notification-prefs-card (only consumer)
- [Phase 13-decomp]: Settings cards each create own supabase client for full independence

### Pending Todos

None.

### Blockers/Concerns

- Supabase auth mocking strategy for Playwright E2E needs phase-specific research (Phase 15)
- Sentry source map upload needs SENTRY_AUTH_TOKEN in Coolify build args (confirmed in Plan 09-01)
- NEXT_PUBLIC_POSTHOG_KEY must be set in Coolify build args for PostHog to activate

## Session Continuity

Last session: 2026-03-09T04:27:32Z
Stopped at: Completed 13-01-PLAN.md (model detail page + settings form decomposition)
Resume file: .planning/phases/13-component-decomposition-react-memo/13-01-SUMMARY.md
