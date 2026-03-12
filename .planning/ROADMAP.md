# Roadmap: AI Market Cap

## Milestones

- ✅ **v1.0 Codebase Health** -- Phases 1-8 (shipped 2026-03-05)
- ✅ **v1.1 Production Readiness** -- Phases 9-19 (shipped 2026-03-11)
- 🚧 **v1.2 Data Pipeline & Launch** -- Phases 20-23 (in progress)

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

<details>
<summary>v1.1 Production Readiness (Phases 9-19) -- SHIPPED 2026-03-11</summary>

- [x] Phase 9: Observability (2/2 plans) -- completed 2026-03-05
- [x] Phase 10: CI Pipeline (1/1 plans) -- completed 2026-03-05
- [x] Phase 11: Zod Runtime Validation (5/5 plans) -- completed 2026-03-08
- [x] Phase 12: Component Testing Infrastructure (3/3 plans) -- completed 2026-03-09
- [x] Phase 13: Component Decomposition + React.memo (4/4 plans) -- completed 2026-03-09
- [x] Phase 14: SWR Data Fetching (6/6 plans) -- completed 2026-03-09
- [x] Phase 15: E2E Testing (3/3 plans) -- completed 2026-03-11
- [x] Phase 16: Code Simplification (2/2 plans) -- completed 2026-03-11
- [x] Phase 17: CI Verification + Branch Protection (1/1 plans) -- completed 2026-03-11
- [x] Phase 18: E2E Model Detail CI Fixture (1/1 plans) -- completed 2026-03-11
- [x] Phase 19: Tech Debt Hardening (1/1 plans) -- completed 2026-03-11

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 Data Pipeline & Launch (In Progress)

**Milestone Goal:** Fix the broken data sync pipeline, make sync failures visible to admins, and deploy to Railway + Supabase Cloud for production launch.

- [x] **Phase 20: Pipeline Hardening** - Seed data_sources, add fail-fast secrets, retry logic, and health endpoints (completed 2026-03-12)
- [x] **Phase 21: Admin Visibility** - Sync job history, stale source alerts, per-adapter health, and manual triggers (completed 2026-03-12)
- [ ] **Phase 22: Railway Deployment** - Docker deploy, env vars, node-cron scheduling, DNS + SSL
- [ ] **Phase 23: Data Integrity Verification** - End-to-end flow verification, empty table detection, freshness checks, quality scoring

## Phase Details

### Phase 20: Pipeline Hardening
**Goal**: The data sync pipeline runs reliably — all 27 adapters are registered, secrets are validated on startup, failures surface immediately instead of silently succeeding, and the pipeline exposes its health over HTTP.
**Depends on**: Phase 19 (v1.1 complete)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07
**Success Criteria** (what must be TRUE):
  1. On first deploy, all 27 adapters appear in the data_sources table without manual SQL
  2. Starting the app with a missing required API key prints a clear error and does not silently continue
  3. A sync run that fails mid-adapter logs the failure with adapter name, error, and timestamp — the cron response body includes per-adapter failure details (adapter name, status, error message) so failures are visible to monitoring
  4. A failing adapter automatically retries up to 3 times with exponential backoff before marking as failed
  5. GET /api/pipeline/health returns a JSON object listing each adapter as healthy, degraded, or down
**Plans:** 3/3 plans complete
Plans:
- [ ] 20-01-PLAN.md — Seed config, startup validation, resolveSecrets refactor
- [ ] 20-02-PLAN.md — Failure reporting, Sentry alerts, verify retry + healthCheck
- [ ] 20-03-PLAN.md — Pipeline health endpoint (/api/pipeline/health)

### Phase 21: Admin Visibility
**Goal**: Admins can see exactly what the pipeline is doing — which syncs ran, which failed, which sources are stale, and they can trigger a resync for any adapter without touching the database or code.
**Depends on**: Phase 20
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05
**Success Criteria** (what must be TRUE):
  1. The admin dashboard at /admin/data-sources shows a table of recent sync jobs with status, error message, timestamp, and records processed for each run
  2. Data sources that have not synced successfully within their expected interval are visually highlighted as stale
  3. The dashboard shows a pipeline health summary (count of healthy / degraded / down adapters) at a glance
  4. Clicking an adapter opens a detail view with its last N sync logs and the specific error from the most recent failure
  5. A "Sync Now" button on any adapter triggers an immediate sync and reflects the result without a page reload
**Plans:** 3/3 plans complete
Plans:
- [ ] 21-01-PLAN.md -- Backend APIs: shared health lib, formatRelativeTime, sync filter, admin health endpoint
- [ ] 21-02-PLAN.md -- Frontend: health summary cards, staleness visualization, expandable rows
- [ ] 21-03-PLAN.md -- Frontend: adapter detail drawer with Sync Now

### Phase 22: Railway Deployment
**Goal**: The app is live on Railway at aimarketcap.com — deployed via git push, all cron jobs running in-process, environment fully configured, and HTTPS working end to end.
**Depends on**: Phase 20
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05
**Success Criteria** (what must be TRUE):
  1. Pushing to main triggers a Railway build and deploys the app — no manual steps required
  2. All 8 cron jobs run on their defined schedules using node-cron inside the Railway process
  3. https://aimarketcap.com loads the app with a valid SSL certificate
  4. GET /api/health returns HTTP 200 with app version, DB connection status, and uptime
  5. All required env vars (Supabase URL/key, API keys, CRON_SECRET, Sentry, PostHog) are set in Railway and the app starts without missing-config errors
**Plans**: TBD

### Phase 23: Data Integrity Verification
**Goal**: There is verifiable, end-to-end proof that data flows from adapters through the database and appears correctly in the UI — and any gaps in coverage or freshness are detectable at a glance.
**Depends on**: Phase 22
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. A verification run confirms that each key table (models, scores, rankings) has rows sourced from live adapter syncs — not just seed data or stale records
  2. Any table that should have data but is empty is flagged with the table name and the adapter responsible for populating it
  3. Sources that have not updated within their declared sync interval are listed with their last-successful-sync timestamp and how long ago that was
  4. Each data source has a quality score (0-100) combining completeness, freshness, and record count trend — viewable in the admin dashboard
**Plans**: TBD

## Progress

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
| 11. Zod Runtime Validation | v1.1 | 5/5 | Complete | 2026-03-08 |
| 12. Component Testing Infrastructure | v1.1 | 3/3 | Complete | 2026-03-09 |
| 13. Component Decomposition + React.memo | v1.1 | 4/4 | Complete | 2026-03-09 |
| 14. SWR Data Fetching | v1.1 | 6/6 | Complete | 2026-03-09 |
| 15. E2E Testing | v1.1 | 3/3 | Complete | 2026-03-11 |
| 16. Code Simplification | v1.1 | 2/2 | Complete | 2026-03-11 |
| 17. CI Verification + Branch Protection | v1.1 | 1/1 | Complete | 2026-03-11 |
| 18. E2E Model Detail CI Fixture | v1.1 | 1/1 | Complete | 2026-03-11 |
| 19. Tech Debt Hardening | v1.1 | 1/1 | Complete | 2026-03-11 |
| 20. Pipeline Hardening | 3/3 | Complete    | 2026-03-12 | - |
| 21. Admin Visibility | 3/3 | Complete    | 2026-03-12 | - |
| 22. Railway Deployment | v1.2 | 0/TBD | Not started | - |
| 23. Data Integrity Verification | v1.2 | 0/TBD | Not started | - |
