# Requirements: AI Market Cap v1.1

**Defined:** 2026-03-05
**Core Value:** Most comprehensive, multi-lens ranking of AI models

## v1.1 Requirements

Requirements for production readiness milestone. Each maps to roadmap phases.

### Observability

- [x] **OBS-01**: Sentry SDK integrated with automatic exception capture on all 65 API routes via handleApiError
- [x] **OBS-02**: Sentry source maps uploaded during Docker build for readable stack traces
- [x] **OBS-03**: PostHog client-side SDK tracks page views and user identification
- [x] **OBS-04**: PostHog custom events capture key user actions (model view, comparison, marketplace interaction)
- [x] **OBS-05**: CSP headers updated in next.config.ts to allow Sentry and PostHog domains

### CI/CD

- [x] **CICD-01**: GitHub Actions workflow runs lint on every PR
- [x] **CICD-02**: GitHub Actions workflow runs `tsc --noEmit` on every PR
- [x] **CICD-03**: GitHub Actions workflow runs `vitest run` on every PR
- [x] **CICD-04**: PR merges blocked unless all CI checks pass

### Runtime Type Safety

- [x] **TYPE-01**: Zod schemas defined for Supabase query results replacing `as unknown as` casts (56 instances across 38 files)
- [x] **TYPE-02**: Shared parseQueryResult utility with graceful fallback for Zod validation at query boundaries
- [x] **TYPE-03**: Sentry error classification distinguishes Zod validation errors from application errors

### Component Testing

- [ ] **TEST-01**: Vitest config extended with jsdom environment for component tests (environmentMatchGlobs preserves node for existing 170 tests)
- [ ] **TEST-02**: Testing Library + React 19 integration verified (peer dep overrides if needed)
- [ ] **TEST-03**: Component tests written for 5+ high-value interactive components (search dialog, filter bar, ranking controls, market ticker, comments)

### Component Decomposition

- [ ] **DECOMP-01**: Model detail page (878 lines) decomposed into focused sub-components
- [ ] **DECOMP-02**: Compare client (709 lines) decomposed into focused sub-components
- [ ] **DECOMP-03**: Settings form (681 lines) decomposed into focused sub-components
- [ ] **DECOMP-04**: Top 5 mega-components in src/components/ (517, 500, 485, 470, 448 lines) decomposed below 300 lines each

### Performance

- [ ] **PERF-01**: SWR replaces useState+useEffect+fetch patterns in client components with appropriate staleTime tiers
- [ ] **PERF-02**: React.memo applied to expensive pure components identified during decomposition
- [x] **PERF-03**: Bundle impact of Sentry + PostHog kept under control via tree-shaking and lazy loading

### E2E Testing

- [ ] **E2E-01**: Playwright installed and configured with Next.js dev server
- [ ] **E2E-02**: E2E test for auth flow (signup, login, session persistence)
- [ ] **E2E-03**: E2E test for model detail page (view model, check scores, navigate tabs)
- [ ] **E2E-04**: E2E test for leaderboard (filter by lens, sort, pagination)
- [ ] **E2E-05**: E2E test for marketplace browse (search, filter, view listing)
- [ ] **E2E-06**: E2E tests integrated into CI pipeline

### Code Simplification

- [ ] **SIMP-01**: Simplification pass over changed files from this milestone (reuse, clarity, efficiency)
- [ ] **SIMP-02**: Unused imports, dead code, and redundant patterns cleaned up across touched files

## v1.2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Real-time

- **RT-01**: WebSocket updates for live market data and auction bids
- **RT-02**: Server-sent events for notification delivery

### Engagement

- **ENG-01**: Transactional email notifications for key events
- **ENG-02**: Email preferences management

### Compliance

- **COMP-01**: Audit logging for financial transactions
- **COMP-02**: Export audit trail for compliance review

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redis caching | Next.js built-in caching sufficient for current scale |
| Datadog/New Relic APM | Overkill for $32/mo Hetzner deployment; Sentry covers errors |
| PostHog self-hosted | Operational overhead not justified; cloud free tier (1M events/month) sufficient |
| Full component test coverage | Diminishing returns; focus on 5+ high-value interactive components |
| E2E for admin flows | Low user impact; admin is internal-only |
| supabase-to-zod code generation | Manual schemas more maintainable for 56 casts; re-evaluate if DB schema changes frequently |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OBS-01 | Phase 9 | Complete |
| OBS-02 | Phase 9 | Complete |
| OBS-03 | Phase 9 | Complete |
| OBS-04 | Phase 9 | Complete |
| OBS-05 | Phase 9 | Complete |
| PERF-03 | Phase 9 | Complete |
| CICD-01 | Phase 10 | Complete |
| CICD-02 | Phase 10 | Complete |
| CICD-03 | Phase 10 | Complete |
| CICD-04 | Phase 10 | Complete |
| TYPE-01 | Phase 11 | Complete |
| TYPE-02 | Phase 11 | Complete |
| TYPE-03 | Phase 11 | Complete |
| TEST-01 | Phase 12 | Pending |
| TEST-02 | Phase 12 | Pending |
| TEST-03 | Phase 12 | Pending |
| DECOMP-01 | Phase 13 | Pending |
| DECOMP-02 | Phase 13 | Pending |
| DECOMP-03 | Phase 13 | Pending |
| DECOMP-04 | Phase 13 | Pending |
| PERF-02 | Phase 13 | Pending |
| PERF-01 | Phase 14 | Pending |
| E2E-01 | Phase 15 | Pending |
| E2E-02 | Phase 15 | Pending |
| E2E-03 | Phase 15 | Pending |
| E2E-04 | Phase 15 | Pending |
| E2E-05 | Phase 15 | Pending |
| E2E-06 | Phase 15 | Pending |
| SIMP-01 | Phase 16 | Pending |
| SIMP-02 | Phase 16 | Pending |

**Coverage:**
- v1.1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
