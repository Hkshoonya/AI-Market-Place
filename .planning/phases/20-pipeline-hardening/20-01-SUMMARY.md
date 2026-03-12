---
phase: 20-pipeline-hardening
plan: 01
subsystem: pipeline
tags: [seeding, startup, secrets, supabase, instrumentation, vitest]

requires: []
provides:
  - DATA_SOURCE_SEEDS array in seed-config.ts with all 26 registered adapters
  - seedDataSources() function with ON CONFLICT DO NOTHING upsert semantics
  - validatePipelineSecrets() with core (fail-fast) / adapter (warn-only) tiering
  - resolveSecrets() returns { secrets, missing } structured result
  - instrumentation.ts wires both startup functions after Sentry init
affects: [20-pipeline-hardening, 21-admin-dashboard, 22-deployment]

tech-stack:
  added: []
  patterns:
    - "Seed-on-startup: idempotent INSERT OR IGNORE seeding avoids manual SQL on first deploy"
    - "Two-tier secret validation: core secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET) fail-fast; adapter secrets warn-only"
    - "resolveSecrets returns structured { secrets, missing } so callers know what is absent"
    - "vi.stubEnv() for env var mutation in Vitest tests (avoids NODE_ENV readonly TS error)"

key-files:
  created:
    - src/lib/data-sources/seed-config.ts
    - src/lib/data-sources/seeder.ts
    - src/lib/data-sources/seeder.test.ts
    - src/lib/pipeline/startup.ts
    - src/lib/pipeline/startup.test.ts
    - src/lib/data-sources/utils.test.ts
  modified:
    - src/lib/data-sources/utils.ts
    - src/lib/data-sources/orchestrator.ts
    - src/lib/agents/residents/pipeline-engineer.ts
    - src/instrumentation.ts

key-decisions:
  - "seed-config.ts is single source of truth: 26 adapters with tier/priority/interval matching migration 015"
  - "seedDataSources uses ignoreDuplicates: true so admin-edited rows are never clobbered"
  - "validatePipelineSecrets checks NEXT_PUBLIC_SUPABASE_URL (not SUPABASE_URL) matching actual codebase usage"
  - "NODE_ENV guarding uses !== 'test' so unit tests never trigger process.exit(1)"

patterns-established:
  - "instrumentation.ts startup order: Sentry first, then validatePipelineSecrets, then seedDataSources, then MSW"
  - "resolveSecrets callers should destructure { secrets, missing } and log warning if missing.length > 0"

requirements-completed: [PIPE-01, PIPE-02, PIPE-04]

duration: 12min
completed: 2026-03-12
---

# Phase 20 Plan 01: Startup Seeding and Secret Validation Summary

**Programmatic data_sources seeding via seed-config.ts (26 adapters), two-tier secret validation with process.exit(1) for core secrets, and resolveSecrets() refactor returning { secrets, missing }**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-12T02:32:02Z
- **Completed:** 2026-03-12T02:44:43Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created `DATA_SOURCE_SEEDS` (seed-config.ts) with all 26 registered adapters; tier/priority/interval values cross-referenced from migration 015_tiered_sync_pg_cron.sql
- Built `seedDataSources()` with `ignoreDuplicates: true` so admin-edited rows are never overwritten; process.exit(1) on missing table (42P01 error) in non-test env
- Built `validatePipelineSecrets()` with core/adapter tiering; core secrets fail startup, adapter secrets log warning and continue; prints "Pipeline secrets: N/M configured" summary
- Refactored `resolveSecrets()` to return `{ secrets, missing }` and updated all 3 call sites (orchestrator.ts, pipeline-engineer.ts)
- Wired both functions into `instrumentation.ts` register() after Sentry init with try/catch that lets process.exit propagate
- 23 unit tests across 3 test files; all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create seed-config, seeder, and startup modules with resolveSecrets refactor** - `36eae6f` (feat) — note: committed as part of 20-03 in prior session
2. **Task 2: Wire startup modules into instrumentation.ts** - `f2f96fb` (feat)

_Note: Task 1 implementation was found already committed (36eae6f feat(20-03)) from a prior session. Tests were written fresh as part of this execution and the commit included instrumentation + test fixes._

## Files Created/Modified

- `src/lib/data-sources/seed-config.ts` - SeedEntry interface + DATA_SOURCE_SEEDS array for all 26 adapters
- `src/lib/data-sources/seeder.ts` - seedDataSources() with ON CONFLICT DO NOTHING upsert
- `src/lib/data-sources/seeder.test.ts` - 6 unit tests covering upsert behavior, exit on 42P01, count mismatch warning
- `src/lib/pipeline/startup.ts` - validatePipelineSecrets() with core/adapter tiering
- `src/lib/pipeline/startup.test.ts` - 7 unit tests covering exit/warn/summary scenarios
- `src/lib/data-sources/utils.test.ts` - 10 unit tests for resolveSecrets() + fetchWithRetry()
- `src/lib/data-sources/utils.ts` - resolveSecrets() refactored to return { secrets, missing }
- `src/lib/data-sources/orchestrator.ts` - call site updated to destructure { secrets, missing }
- `src/lib/agents/residents/pipeline-engineer.ts` - call site updated to use { secrets }
- `src/instrumentation.ts` - register() wired with validatePipelineSecrets() + seedDataSources()

## Decisions Made

- Used `NEXT_PUBLIC_SUPABASE_URL` (not `SUPABASE_URL`) as a core secret because that is the env var the codebase actually uses (orchestrator.ts line 42)
- `ignoreDuplicates: true` in upsert rather than merge strategy — preserves admin overrides to tier, priority, and enabled status
- NODE_ENV check uses `!== "test"` guard in both seeder and startup to prevent process.exit in unit test runs
- Used `vi.stubEnv()` in tests to mutate NODE_ENV without TypeScript readonly error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pipeline-engineer.ts using old resolveSecrets() return type**
- **Found during:** Task 2 verification (npx tsc --noEmit)
- **Issue:** `pipeline-engineer.ts:69` passed full `{ secrets, missing }` object to `adapter.healthCheck()` which expects `Record<string, string>`
- **Fix:** Changed `const secrets = resolveSecrets(...)` to `const { secrets } = resolveSecrets(...)`
- **Files modified:** src/lib/agents/residents/pipeline-engineer.ts
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** f2f96fb (Task 2 commit)

**2. [Rule 1 - Bug] Fixed test files using process.env.NODE_ENV direct assignment (TS readonly)**
- **Found during:** Task 2 verification (npx tsc --noEmit)
- **Issue:** TypeScript treats `process.env.NODE_ENV` as readonly; direct assignment fails type check
- **Fix:** Replaced all `process.env.NODE_ENV = "..."` with `vi.stubEnv("NODE_ENV", "...")` and `vi.unstubAllEnvs()` in afterEach
- **Files modified:** src/lib/data-sources/seeder.test.ts, src/lib/pipeline/startup.test.ts
- **Verification:** `npx tsc --noEmit` clean, all 23 tests pass
- **Committed in:** f2f96fb (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both auto-fixes required for TypeScript correctness. No scope creep.

## Issues Encountered

- Task 1 implementation was found already committed in HEAD (36eae6f feat(20-03)) from a prior session that executed 20-01 and 20-03 together without creating a 20-01-SUMMARY.md. This execution wrote the tests fresh and handled the instrumentation wiring (Task 2) which was not in that prior commit.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- `data_sources` table will be seeded on first deploy without manual SQL
- Pipeline secrets validated at startup with clear error messages
- `resolveSecrets()` call sites all updated — no silent missing-secret failures
- Ready for Phase 20 Plan 02 (orchestrator failure reporting improvements)

---
*Phase: 20-pipeline-hardening*
*Completed: 2026-03-12*
