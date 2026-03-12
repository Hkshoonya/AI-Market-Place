---
phase: 20-pipeline-hardening
verified: 2026-03-12T04:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 20: Pipeline Hardening Verification Report

**Phase Goal:** The data sync pipeline runs reliably — all 27 adapters are registered, secrets are validated on startup, failures surface immediately instead of silently succeeding, and the pipeline exposes its health over HTTP.
**Verified:** 2026-03-12
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | On first deploy, adapters from loadAllAdapters() appear in data_sources table without manual SQL | VERIFIED | `seedDataSources()` in seeder.ts calls upsert with `ignoreDuplicates: true`; wired in instrumentation.ts register() |
| 2 | Starting the app with a missing core secret prints a clear error and exits | VERIFIED | `validatePipelineSecrets()` in startup.ts: missingCore triggers log.error + process.exit(1) when NODE_ENV !== "test" |
| 3 | Starting the app with a missing adapter secret logs a warning but continues | VERIFIED | startup.ts loop over missingAdapter calls log.warn per key; no process.exit() |
| 4 | resolveSecrets() returns { secrets, missing } so callers know which env vars are absent | VERIFIED | utils.ts lines 147-161: returns typed `{ secrets: Record<string,string>; missing: string[] }`; orchestrator.ts line 72 destructures it |
| 5 | Startup log shows summary: Pipeline secrets: N/M configured | VERIFIED | startup.ts line 76: `log.info(\`Pipeline secrets: ${configuredCount}/${totalSecrets} configured\`)` |
| 6 | A cron sync response body includes per-adapter success/failure breakdown with error messages | VERIFIED | route.ts lines 47-53: `details: result.details.map(d => ({ ..., errors: d.errors.map(e => e.message) }))` and `overallStatus` field |
| 7 | A failing adapter that has 3+ consecutive failures triggers a Sentry warning | VERIFIED | orchestrator.ts lines 198-214: `if (failureCount >= 3) { Sentry.captureMessage(..., { level: "warning", tags: {...}, extra: {...} }) }` |
| 8 | Each adapter failure writes a structured system_logs entry with adapter name, error, tier, duration, and consecutive failure count | VERIFIED | orchestrator.ts lines 188-195: `systemLog.error("sync-orchestrator", "Adapter sync failed", { adapter, adapter_type, tier, durationMs, consecutiveFailures, error })` |
| 9 | GET /api/pipeline/health returns aggregate pipeline status (public summary + authed per-adapter breakdown) | VERIFIED | route.ts: public path returns PipelineHealthSummarySchema; authed path returns PipelineHealthDetailSchema with adapters[]; computeStatus() implements worst-wins logic |

**Score:** 9/9 truths verified

---

### Adapter Count Note (PIPE-01)

The requirement text says "all 27 adapters." The implementation seeds 26 entries. The 27th file (`src/lib/data-sources/adapters/provider-pricing.ts`) is NOT a sync adapter — it exports a static `KNOWN_PRICES` constant with no `registerAdapter()` call and no `sync()` method. It is a pricing reference module, not a data source adapter. The registry correctly imports 26 real adapters. The seeding covers all actual adapters; the "27" in the requirement reflects an incorrect count of adapter files vs actual adapters. This is a documentation discrepancy, not an implementation gap — PIPE-01 is satisfied.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/data-sources/seed-config.ts` | Centralized config array for all registered adapters | VERIFIED | Exports `DATA_SOURCE_SEEDS: SeedEntry[]` with 26 adapter entries across tiers 0-3; `SeedEntry` interface defined |
| `src/lib/data-sources/seeder.ts` | seedDataSources() with ON CONFLICT DO NOTHING | VERIFIED | Exports `seedDataSources()`, uses `{ onConflict: "slug", ignoreDuplicates: true }`, handles 42P01 error, logs count summary |
| `src/lib/pipeline/startup.ts` | validatePipelineSecrets() with core/adapter tiering | VERIFIED | Exports `validatePipelineSecrets()`; CORE_SECRETS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"]; exits on core missing, warns on adapter missing |
| `src/lib/data-sources/utils.ts` | resolveSecrets returning { secrets, missing } | VERIFIED | Line 147: return type is `{ secrets: Record<string, string>; missing: string[] }` |
| `src/instrumentation.ts` | Startup wiring for seeder + secret validation | VERIFIED | Dynamic imports of both modules in Node.js runtime block; order: Sentry first, validatePipelineSecrets, seedDataSources, MSW |
| `src/lib/data-sources/orchestrator.ts` | Sentry captureMessage on 3+ consecutive failures, structured system_log on each failure | VERIFIED | `import * as Sentry` at top; systemLog.error on every failure; Sentry.captureMessage at failureCount >= 3 |
| `src/lib/pipeline-health.ts` | recordSyncFailure returning new consecutive failure count | VERIFIED | Return type `Promise<number>`; returns `failures` (incremented count) |
| `src/app/api/cron/sync/route.ts` | Cron route returning per-adapter failure details in body | VERIFIED | `errors: d.errors.map((e) => e.message)` + `overallStatus` field |
| `src/app/api/pipeline/health/route.ts` | Pipeline health endpoint with public/authed views | VERIFIED | Exports `GET`; `computeStatus()` implements 3-tier health rules; Zod validates both response shapes; `force-dynamic` set |
| `src/app/api/pipeline/health/route.test.ts` | Tests for public summary and authed detail responses | VERIFIED | 490 lines; 13 tests covering public, authed, healthy, degraded, down, staleness, never-synced, error scenarios |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/instrumentation.ts` | `src/lib/pipeline/startup.ts` | dynamic import in register() | WIRED | Line 12: `await import("@/lib/pipeline/startup")` |
| `src/instrumentation.ts` | `src/lib/data-sources/seeder.ts` | dynamic import in register() | WIRED | Line 15: `await import("@/lib/data-sources/seeder")` |
| `src/lib/data-sources/seeder.ts` | `src/lib/data-sources/seed-config.ts` | import DATA_SOURCE_SEEDS | WIRED | Line 12: `import { DATA_SOURCE_SEEDS } from "./seed-config"` |
| `src/lib/data-sources/orchestrator.ts` | `src/lib/data-sources/utils.ts` | destructured resolveSecrets call | WIRED | Line 72: `const { secrets, missing } = resolveSecrets(source.secret_env_keys)` |
| `src/lib/data-sources/orchestrator.ts` | `@sentry/nextjs` | Sentry.captureMessage for consecutive failures | WIRED | Line 9: `import * as Sentry`; line 199: `Sentry.captureMessage(...)` |
| `src/lib/data-sources/orchestrator.ts` | `src/lib/logging.ts` | systemLog.error for structured failure logging | WIRED | Line 21: `import { systemLog }`; line 188: `void systemLog.error("sync-orchestrator", ...)` |
| `src/app/api/cron/sync/route.ts` | `src/lib/data-sources/orchestrator.ts` | runTierSync() result mapped into response body with error messages | WIRED | Line 52: `errors: d.errors.map((e) => e.message)` |
| `src/app/api/pipeline/health/route.ts` | pipeline_health table | Supabase query | WIRED | Line 87: `.from("pipeline_health").select(...)` |
| `src/app/api/pipeline/health/route.ts` | data_sources table | Supabase query | WIRED | Line 84: `.from("data_sources").select(...)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PIPE-01 | 20-01 | System seeds data_sources table with all 27 adapters on first deploy | SATISFIED | seedDataSources() upserts 26 real adapters (provider-pricing.ts is not a sync adapter, count discrepancy is in requirement text) |
| PIPE-02 | 20-01 | resolveSecrets() fails fast with clear error when required API keys are missing | SATISFIED | validatePipelineSecrets() exits on missing core secrets; resolveSecrets() returns { secrets, missing } so callers handle absence |
| PIPE-03 | 20-02 | Orchestrator reports per-adapter success/failure status (not silent 200 OK) | SATISFIED | Cron route body includes per-adapter errors[] as strings + overallStatus; orchestrator fires systemLog.error + Sentry at 3+ failures |
| PIPE-04 | 20-01 | All adapter API keys validated on app startup with clear log output | SATISFIED | validatePipelineSecrets() checks all adapter secret_env_keys from DATA_SOURCE_SEEDS; logs "Pipeline secrets: N/M configured" |
| PIPE-05 | 20-02 | Failed syncs automatically retry with exponential backoff (max 3 retries) | SATISFIED | fetchWithRetry in utils.ts: maxRetries=3, exponential backoff, retries on 429/5xx; verified by utils.test.ts |
| PIPE-06 | 20-02 | Each adapter exposes a health check (connectivity + auth validation) | SATISFIED | DataSourceAdapter interface requires healthCheck(); verified by adapter-syncer.test.ts for createAdapterSyncer-based adapters |
| PIPE-07 | 20-03 | /api/pipeline/health endpoint returns aggregate pipeline status | SATISFIED | GET /api/pipeline/health: public returns {status, healthy, degraded, down, checkedAt}; authed adds adapters[]; computeStatus() implements 3-tier rules |

All 7 requirements (PIPE-01 through PIPE-07) are satisfied. No orphaned requirements — every requirement mapped to Phase 20 in REQUIREMENTS.md is claimed by one of the three plans and implemented.

---

### Anti-Patterns Found

No anti-patterns detected in the 8 key files modified/created by this phase. No TODO/FIXME/PLACEHOLDER comments. No empty implementations. No stub return values.

---

### Test Coverage Summary

| Test File | Tests | Coverage |
|-----------|-------|---------|
| `src/lib/data-sources/seeder.test.ts` | 5 tests | upsert behavior, ignoreDuplicates, 42P01 exit, count mismatch warning, summary log |
| `src/lib/pipeline/startup.test.ts` | 7 tests | all 3 core secrets, non-test exit, test env no-exit, adapter warning, summary format |
| `src/lib/data-sources/utils.test.ts` | 10 tests | resolveSecrets (present/missing/mixed), fetchWithRetry (retries/backoff/non-retry) |
| `src/lib/data-sources/orchestrator.test.ts` | 7 tests | systemLog.error on failure, Sentry threshold at 3/5, no Sentry at 1/2, missing secrets warn, no error on success |
| `src/app/api/cron/sync/route.test.ts` | 11 tests | auth, tier validation, error message shape, overallStatus partial/success |
| `src/lib/data-sources/shared/adapter-syncer.test.ts` | 5 tests | PIPE-06: healthCheck implementation on createAdapterSyncer adapters |
| `src/app/api/pipeline/health/route.test.ts` | 13 tests | public/authed views, healthy/degraded/down status, staleness rules, never-synced adapter, DB error |

**Total:** 58 tests across 7 test files.

---

### Human Verification Required

None. All critical behaviors are covered by unit tests and code inspection.

The following items are observable at runtime but not blocking:

1. **Startup log output at deploy time**
   - Test: Deploy to staging with a missing adapter secret (e.g., unset CIVITAI_API_KEY)
   - Expected: Server log shows "Missing adapter secret CIVITAI_API_KEY" warning and "Pipeline secrets: N/M configured" summary
   - Why human: Cannot execute startup in test environment; covered by unit tests

2. **data_sources table population on fresh deploy**
   - Test: Wipe the data_sources table in a staging Supabase instance, restart the app
   - Expected: Table auto-populated with 26 adapter rows via seedDataSources()
   - Why human: Requires live Supabase connection; covered by unit tests with mock client

---

## Verification Summary

All 9 observable truths verified. All 7 requirements (PIPE-01 through PIPE-07) satisfied with implementation evidence. All 9 key artifact-to-artifact links confirmed wired. 58 unit tests across 7 test files provide coverage of all non-trivial behaviors.

The only anomaly found is benign: PIPE-01 says "27 adapters" but the implementation correctly seeds 26 real sync adapters. The 27th adapter-shaped file (`provider-pricing.ts`) is a static pricing reference that exports `KNOWN_PRICES` — it has no `registerAdapter()` call and is not a data source. The requirement count is an off-by-one in the requirement text, not a missing implementation.

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_
