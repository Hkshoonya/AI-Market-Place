---
phase: 15-e2e-testing
plan: "03"
subsystem: e2e-testing
tags: [playwright, e2e, marketplace, ci-pipeline]
dependency_graph:
  requires: [15-01]
  provides: [marketplace-e2e-spec, ci-e2e-job]
  affects: [ci-pipeline]
tech_stack:
  added: []
  patterns:
    - "page.route for REST mock returning empty arrays (offline marketplace browse)"
    - "test.skip() conditional on listing count for graceful offline skipping"
    - "Dummy Supabase env vars hardcoded in CI job (not secrets) for fully offline E2E"
    - "Parallel CI job (no needs) for independent e2e execution alongside lint/typecheck/test"
key_files:
  created:
    - e2e/marketplace.spec.ts
  modified:
    - .github/workflows/ci.yml
decisions:
  - "Marketplace browse page is RSC with server-side Supabase queries — tests verify page shell (heading, filter bar) that renders even with zero listings from failed DB calls"
  - "REST mock returns empty array with content-range 0-0/0 header so server component parses empty result set without crashing"
  - "CI e2e job uses dummy Supabase env vars hardcoded in workflow YAML (not secrets) — tests are fully offline, no real Supabase dependency"
  - "E2E job runs in parallel with lint/typecheck/test (no needs/depends_on) — independent parallel check"
  - "Upload both playwright-report/ (HTML report) and playwright-results/ (screenshots/traces) as separate artifacts on failure only"
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_changed: 2
---

# Phase 15 Plan 03: Marketplace E2E Tests + CI Integration Summary

Marketplace browse E2E spec with 5 tests covering URL param handling, filter bar rendering, and listing navigation — running fully offline — plus CI pipeline integration with a parallel e2e job using dummy Supabase env vars.

## What Was Built

**Marketplace spec** (`e2e/marketplace.spec.ts`): 5 tests targeting the marketplace browse page:

1. Browse page loads with heading and filter bar — verifies default `"Browse Marketplace"` heading and filter bar search input/sort group render even with zero listings
2. Search via URL parameter shows search heading — navigates to `?q=test`, verifies server-side URL parsing produces `Search: "test"` heading
3. Type filter via URL parameter shows filtered heading — navigates to `?type=api_access`, verifies heading changes to `"API Access"` from `LISTING_TYPE_MAP`
4. Sort parameter changes page without error — navigates to `?sort=price_asc` then `?sort=popular`, verifies page renders without crashing
5. Clicking a listing navigates to detail page — conditionally skips with `test.skip()` if no listings exist (offline mode), otherwise clicks first listing and verifies URL pattern

**REST mock pattern:** `page.route("**/rest/v1/**")` intercepts all Supabase REST calls, returning `[]` with `content-range: 0-0/0` header so the RSC page component receives an empty result set without DB errors.

**CI E2E job** (`.github/workflows/ci.yml`): Added `e2e` job running in parallel with existing `lint`, `typecheck`, `test` jobs:
- `timeout-minutes: 15` for dev server startup + browser tests
- Dummy `NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key` hardcoded in job `env` (NOT secrets)
- `npx playwright install --with-deps chromium firefox` for ubuntu-latest OS dependencies
- Uploads `playwright-report/` (HTML report) and `playwright-results/` (screenshots + trace files) as separate `actions/upload-artifact@v4` artifacts on failure only

## Verification

- `npx playwright test e2e/marketplace.spec.ts --project=chromium-desktop` — 4 passed, 1 skipped (listing navigation — no listings in offline mode)
- `.github/workflows/ci.yml` contains e2e job with dummy Supabase env vars, no `secrets.NEXT_PUBLIC_SUPABASE_*`
- Both `playwright-report/` and `playwright-results/` uploaded as separate artifacts on failure
- Existing CI jobs (lint, typecheck, test) unchanged
- YAML syntax valid

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| File | Status |
|------|--------|
| e2e/marketplace.spec.ts | FOUND |
| .github/workflows/ci.yml | FOUND (updated) |

| Commit | Status |
|--------|--------|
| 101ddd3 (Task 1) | FOUND |
| 3744031 (Task 2) | FOUND |
