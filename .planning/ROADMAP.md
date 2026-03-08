# Roadmap: AI Market Cap

## Milestones

- ✅ **v1.0 Codebase Health** -- Phases 1-8 (shipped 2026-03-05)
- 🚧 **v1.1 Production Readiness** -- Phases 9-16 (in progress)

## Phases

<details>
<summary>v1.0 Codebase Health (Phases 1-8) -- SHIPPED 2026-03-05</summary>

- [x] Phase 1: Test Infrastructure + Constants (2/2 plans) -- completed 2026-03-03
- [x] Phase 2: Scoring Simplification (3/3 plans) -- completed 2026-03-04
- [x] Phase 3: API Route Decomposition (2/2 plans) -- completed 2026-03-04
- [x] Phase 4: Adapter Deduplication (3/3 plans) -- completed 2026-03-04
- [x] Phase 5: Component Decomposition (3/3 plans) -- completed 2026-03-04
- [x] Phase 6: Type Safety (7/7 plans) -- completed 2026-03-04
- [x] Phase 7: Error Handling + Logging (5/5 plans) -- completed 2026-03-05
- [x] Phase 8: Regression Testing (3/3 plans) -- completed 2026-03-05

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v1.1 Production Readiness (In Progress)

**Milestone Goal:** Harden the platform for production with observability, testing, CI/CD, performance, and code quality improvements.

- [x] **Phase 9: Observability** - Sentry error tracking + PostHog analytics with controlled bundle impact (completed 2026-03-05)
- [x] **Phase 10: CI Pipeline** - GitHub Actions enforcing lint, typecheck, and tests on every PR (completed 2026-03-05)
- [ ] **Phase 11: Zod Runtime Validation** - Replace 56 unsafe type casts with Zod schemas at query boundaries (UAT gap closure in progress)
- [ ] **Phase 12: Component Testing Infrastructure** - Vitest jsdom + Testing Library setup with component tests for high-value components
- [ ] **Phase 13: Component Decomposition + React.memo** - Break remaining mega-components below 300 lines, memoize expensive renders
- [ ] **Phase 14: SWR Data Fetching** - Replace useState+useEffect+fetch with SWR hooks and staleTime tiers
- [ ] **Phase 15: E2E Testing** - Playwright tests for critical user paths integrated into CI
- [ ] **Phase 16: Code Simplification** - Final cleanup pass over all milestone changes

## Phase Details

### Phase 9: Observability
**Goal**: Developers see production errors in real-time and product usage patterns are tracked automatically
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, PERF-03
**Success Criteria** (what must be TRUE):
  1. Unhandled exceptions in any API route appear in Sentry dashboard with readable stack traces (not minified)
  2. Page views and user sessions are visible in PostHog dashboard without manual instrumentation
  3. Key user actions (viewing a model, comparing models, marketplace interactions) generate PostHog custom events
  4. Application loads without CSP violations in browser console after Sentry and PostHog domains are allowed
  5. Production bundle size increase from Sentry + PostHog is under 50KB gzipped via tree-shaking and lazy loading
**Plans:** 2/2 plans complete
Plans:
- [x] 09-01-PLAN.md -- Sentry error tracking, CSP headers, source map upload, Dockerfile
- [ ] 09-02-PLAN.md -- PostHog analytics, pageview tracking, user identification, custom events

### Phase 10: CI Pipeline
**Goal**: No PR can merge without passing lint, typecheck, and all tests
**Depends on**: Phase 9
**Requirements**: CICD-01, CICD-02, CICD-03, CICD-04
**Success Criteria** (what must be TRUE):
  1. Opening a PR triggers a GitHub Actions workflow that runs ESLint, `tsc --noEmit`, and `vitest run`
  2. A PR with a type error or failing test shows a red check and cannot be merged
  3. A clean PR shows all green checks and the merge button is enabled
**Plans:** 1/1 plans complete
Plans:
- [ ] 10-01-PLAN.md -- CI workflow (lint, typecheck, test) + branch protection setup

### Phase 11: Zod Runtime Validation
**Goal**: Supabase query results are validated at runtime instead of silently cast with `as unknown as`
**Depends on**: Phase 10
**Requirements**: TYPE-01, TYPE-02, TYPE-03
**Success Criteria** (what must be TRUE):
  1. All 56 `as unknown as` casts across 38 files are replaced with Zod `.parse()` or `.safeParse()` calls
  2. A Supabase query returning unexpected shape logs a Zod validation error to Sentry (distinct from application errors) and falls back gracefully
  3. `npx tsc --noEmit` passes clean and all 170+ existing tests still pass
**Plans:** 5 plans (3 complete, 2 gap closure)
Plans:
- [x] 11-01-PLAN.md -- parseQueryResult utilities, domain-grouped Zod schemas, unit tests
- [x] 11-02-PLAN.md -- Migrate server pages, API routes, and lib utilities (~35 casts)
- [x] 11-03-PLAN.md -- Migrate client components (~10 casts) and fix Recharts casts
- [ ] 11-04-PLAN.md -- [GAP CLOSURE] Fix z.coerce.number() for PostgREST strings, is_open_weights nullable, admin analytics error handling
- [ ] 11-05-PLAN.md -- [GAP CLOSURE] Fix orders page FK alias joins with two-query enrichment, buyer_id nullable

### Phase 12: Component Testing Infrastructure
**Goal**: High-value interactive components have render and interaction tests proving they work correctly
**Depends on**: Phase 10
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. `vitest run` executes both existing node-environment tests (170+) and new jsdom component tests in a single run
  2. Testing Library renders React 19 components without peer dependency errors or warnings
  3. At least 5 interactive components (search dialog, filter bar, ranking controls, market ticker, comments) have tests covering render and user interaction
**Plans**: TBD

### Phase 13: Component Decomposition + React.memo
**Goal**: No component file exceeds 300 lines, and expensive pure components avoid unnecessary re-renders
**Depends on**: Phase 12
**Requirements**: DECOMP-01, DECOMP-02, DECOMP-03, DECOMP-04, PERF-02
**Success Criteria** (what must be TRUE):
  1. Model detail page (878 lines), compare client (709 lines), and settings form (681 lines) are each decomposed into focused sub-components under 300 lines
  2. Top 5 mega-components in src/components/ (517, 500, 485, 470, 448 lines) are each under 300 lines
  3. React.memo wraps identified expensive pure components so React DevTools shows skipped re-renders on parent state changes
  4. All existing tests plus new component tests still pass after decomposition
**Plans**: TBD

### Phase 14: SWR Data Fetching
**Goal**: Client components use SWR for data fetching with automatic caching, revalidation, and stale-while-revalidate behavior
**Depends on**: Phase 13
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):
  1. All client-side useState+useEffect+fetch patterns are replaced with useSWR hooks
  2. SWR staleTime is configured in tiers (fast-changing data like scores vs slow-changing data like model metadata)
  3. Navigating away from and back to a page shows cached data immediately while revalidating in the background
**Plans**: TBD

### Phase 15: E2E Testing
**Goal**: Critical user journeys are verified end-to-end with Playwright, and E2E failures block PR merges
**Depends on**: Phase 14
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06
**Success Criteria** (what must be TRUE):
  1. `npx playwright test` runs against a local Next.js dev server and passes
  2. Auth flow E2E: signup, login, session persistence across page reload, and logout all work
  3. Model detail E2E: navigating to a model shows scores, and tab navigation works
  4. Leaderboard E2E: switching lens filter changes displayed models, sort works, pagination navigates pages
  5. Marketplace E2E: search returns results, filters narrow listings, clicking a listing shows detail
**Plans**: TBD

### Phase 16: Code Simplification
**Goal**: All code touched during this milestone is clean, with no dead code, unused imports, or redundant patterns
**Depends on**: Phase 15
**Requirements**: SIMP-01, SIMP-02
**Success Criteria** (what must be TRUE):
  1. No unused imports remain in files modified during v1.1 phases
  2. No dead code or unreachable branches exist in files touched during this milestone
  3. `npx tsc --noEmit` and `vitest run` both pass clean after simplification
**Plans**: TBD

## Progress

**Execution Order:** Phases 9 through 16, sequential. Phases 11 and 12 can run in parallel (both depend only on Phase 10).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Test Infrastructure + Constants | v1.0 | 2/2 | Complete | 2026-03-03 |
| 2. Scoring Simplification | v1.0 | 3/3 | Complete | 2026-03-04 |
| 3. API Route Decomposition | v1.0 | 2/2 | Complete | 2026-03-04 |
| 4. Adapter Deduplication | v1.0 | 3/3 | Complete | 2026-03-04 |
| 5. Component Decomposition | v1.0 | 3/3 | Complete | 2026-03-04 |
| 6. Type Safety | v1.0 | 7/7 | Complete | 2026-03-04 |
| 7. Error Handling + Logging | v1.0 | 5/5 | Complete | 2026-03-05 |
| 8. Regression Testing | v1.0 | 3/3 | Complete | 2026-03-05 |
| 9. Observability | v1.1 | 2/2 | Complete | 2026-03-05 |
| 10. CI Pipeline | v1.1 | 1/1 | Complete | 2026-03-05 |
| 11. Zod Runtime Validation | v1.1 | 3/5 | Gap closure | 2026-03-08 |
| 12. Component Testing Infrastructure | v1.1 | 0/? | Not started | - |
| 13. Component Decomposition + React.memo | v1.1 | 0/? | Not started | - |
| 14. SWR Data Fetching | v1.1 | 0/? | Not started | - |
| 15. E2E Testing | v1.1 | 0/? | Not started | - |
| 16. Code Simplification | v1.1 | 0/? | Not started | - |
