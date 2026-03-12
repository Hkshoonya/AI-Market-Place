# Phase 20: Pipeline Hardening - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The data sync pipeline runs reliably — all 27 adapters are registered, secrets are validated on startup, failures surface immediately instead of silently succeeding, and the pipeline exposes its health over HTTP.

Requirements: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07

</domain>

<decisions>
## Implementation Decisions

### Seeding strategy
- Seed on app startup via `seedDataSources()` — not migration-only
- Source of truth: centralized config file (`src/lib/data-sources/seed-config.ts`) mapping all 27 adapters to tier, priority, interval, secret_env_keys, output_types
- Insert-only mode: `ON CONFLICT (slug) DO NOTHING` — existing rows untouched, admin overrides preserved
- New adapters auto-appear on next deploy without manual SQL
- If `data_sources` table doesn't exist: fail startup with clear error ("Run Supabase migrations first") and `process.exit(1)`

### Secret validation strictness
- Two tiers of secrets: **core** (fail startup) vs **adapter** (warn only)
- Core secrets that fail startup: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- Adapter secrets: warn per adapter, mark as degraded (static-only mode), app continues
- `resolveSecrets()` returns `{ secrets, missing }` — caller decides how to handle
- Startup log: summary table format — "Pipeline secrets: 25/27 configured" then list only missing ones with their adapter name

### Failure reporting
- Cron sync endpoint always returns HTTP 200 (cron job itself succeeded), with per-adapter success/failure breakdown in response body
- Body includes: `tier`, `sourcesRun`, `sourcesSucceeded`, `sourcesFailed`, `details[]` with per-adapter status and error
- Sentry alert after 3+ consecutive failures per adapter (uses `pipeline_health.consecutive_failures`)
- Each adapter failure writes a structured `system_logs` entry: adapter name, error message, retries attempted, tier, duration_ms, consecutive failure count
- Retry scope: HTTP-level only via existing `fetchWithRetry` (3 retries, exponential backoff) — no orchestrator-level adapter retry needed

### Health endpoint design
- Two separate endpoints: `/api/health` (app-level, Phase 22) and `/api/pipeline/health` (pipeline-specific, this phase)
- `/api/pipeline/health` returns full per-adapter detail: slug, status, lastSync, consecutiveFailures, recordCount, error
- Auth model: public request gets summary only (`status`, `healthy`, `degraded`, `down` counts); authenticated request (Bearer CRON_SECRET) gets full adapter breakdown
- Status determination: combine consecutive_failures AND staleness, worst wins
  - `consecutive_failures == 0` AND synced within interval → healthy
  - `consecutive_failures 1-2` OR `last_sync > 2x expected_interval` → degraded
  - `consecutive_failures >= 3` OR `last_sync > 4x expected_interval` → down
- Top-level `status` field: "healthy" if all adapters healthy, "degraded" if any degraded, "down" if any down

### Claude's Discretion
- Exact structure of seed-config.ts entries (field names, grouping)
- How to wire seedDataSources() into app startup (instrumentation.ts vs middleware vs standalone)
- Zod schema for health endpoint response
- Whether to add healthCheck pre-validation before each adapter sync in orchestrator
- Exact Sentry severity level and tag structure for consecutive failure alerts

</decisions>

<specifics>
## Specific Ideas

No specific requirements — user chose recommended approaches for all areas. Implementation should follow existing codebase patterns (createTaggedLogger, handleApiError, Zod validation at boundaries).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAdapterSyncer` factory (`src/lib/data-sources/shared/adapter-syncer.ts:113-220`): Already provides `healthCheck` method per adapter — wire into health endpoint
- `fetchWithRetry` (`src/lib/data-sources/utils.ts:15-84`): Exponential backoff with 429/5xx retry already implemented — satisfies PIPE-05
- `resolveSecrets()` (`src/lib/data-sources/utils.ts:138-148`): Exists but returns partial silently — needs refactor to return `{ secrets, missing }`
- `pipeline_health` table: Already tracks `consecutive_failures`, `last_success_at`, `expected_interval_hours` — perfect for health status rules
- `recordSyncSuccess/recordSyncFailure` (`src/lib/pipeline-health.ts:18-44`): Already manage consecutive_failures counter
- `trackCronRun` / `CronTracker` (`src/lib/cron-tracker.ts:39-134`): Already records cron execution to `cron_runs` table
- `systemLog` (`src/lib/logging.ts:67-100`): Structured logging to `system_logs` table with metadata JSONB
- Migration `002_enable_free_pipeline.sql`: Has INSERT statements for adapters — reference for seed-config.ts field mapping

### Established Patterns
- `handleApiError` + Sentry: Used in all 65 API routes — new endpoints must follow
- `createTaggedLogger`: Used in 20+ modules — new pipeline modules must use
- Zod `parseQueryResult`: Used at 62 call sites — health endpoint should validate DB queries
- Bearer token auth: Cron routes validate `Authorization: Bearer ${CRON_SECRET}` — health endpoint auth uses same pattern

### Integration Points
- `src/lib/data-sources/registry.ts` → `loadAllAdapters()`: Seed config must match registered adapter IDs
- `src/lib/data-sources/orchestrator.ts:46-194` → `runTierSync()`: Add structured failure logging after sync completes
- `src/app/api/cron/sync/route.ts:16-59`: Currently returns 200 always — update to include failure details in body
- `instrumentation.ts` or app startup: Wire in `seedDataSources()` and core secret validation
- `src/types/database.ts:215-234`: DataSource type definition — seed config must match this schema

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-pipeline-hardening*
*Context gathered: 2026-03-11*
