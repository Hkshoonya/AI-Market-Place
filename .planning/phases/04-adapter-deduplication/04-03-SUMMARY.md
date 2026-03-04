---
phase: 04-adapter-deduplication
plan: 03
subsystem: api
tags: [typescript, data-sources, refactoring, factory, adapters]

# Dependency graph
requires:
  - "04-01: KnownModelMeta, ProviderDefaults, known-model data files"
  - "04-02: buildRecord() factory, ModelRecord type"
provides:
  - "createAdapterSyncer() generic factory in shared/adapter-syncer.ts"
  - "AdapterSyncerConfig<TApiResult> interface in shared/adapter-syncer.ts"
  - "anthropic-models.ts rewired to use factory (221 lines, down from 501)"
  - "openai-models.ts rewired to use factory (186 lines, down from 767)"
  - "google-models.ts rewired to use factory (229 lines, down from 606)"
affects:
  - "ADAPT-01, ADAPT-03, ADAPT-04 all satisfied — phase 04 complete"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createAdapterSyncer<TApiResult>() generic factory: inject scrapeFn/apiFn/enrichFn for provider quirks"
    - "AdapterSyncerConfig.healthCheckUrl accepts string | ((apiKey: string) => string) for query-param API keys"
    - "boundBuildRecord pattern: each adapter defines a closure pre-filled with its PROVIDER_DEFAULTS and known-model map"
    - "enrichFn receives (recordMap, apiResult, now, buildRecordFn) — all context needed for any enrichment pattern"

key-files:
  created:
    - "src/lib/data-sources/shared/adapter-syncer.ts"
  modified:
    - "src/lib/data-sources/adapters/anthropic-models.ts"
    - "src/lib/data-sources/adapters/openai-models.ts"
    - "src/lib/data-sources/adapters/google-models.ts"
    - "src/lib/data-sources/shared/build-record.ts"

key-decisions:
  - "AdapterSyncerConfig.healthCheckUrl supports function overload for Google's query-param API key pattern"
  - "buildRecord() return type widened from ModelRecord to Record<string, unknown> — eliminates double-cast in adapters"
  - "Google adapter omits all ProviderDefaults category/modality/license fields — per-model values from GOOGLE_KNOWN_MODELS win"
  - "enrichFn signature passes buildRecordFn explicitly — avoids closure over outer scope, keeps factory pure"

requirements-completed: [ADAPT-01, ADAPT-03, ADAPT-04]

# Metrics
duration: 7min
completed: 2026-03-04
---

# Phase 4 Plan 03: createAdapterSyncer() Factory and 3 Main Adapter Rewires Summary

**Generic createAdapterSyncer<TApiResult>() factory with injected scrapeFn/apiFn/enrichFn, plus anthropic/openai/google rewired to slim wrappers — ~1500 lines eliminated, all 65 tests passing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T05:08:00Z
- **Completed:** 2026-03-04T05:15:00Z
- **Tasks:** 2 of 2
- **Files modified:** 1 created, 4 modified

## Accomplishments

- Created `src/lib/data-sources/shared/adapter-syncer.ts` with `createAdapterSyncer<TApiResult>()` generic factory
- Factory implements the static → scrape → API → upsert pipeline with fully injected provider-specific functions
- `AdapterSyncerConfig<TApiResult>` interface defines all injection points: `scrapeFn`, `apiFn`, `enrichFn`, `healthCheckUrl/Headers`
- Removed inline KNOWN_MODELS (~186+450+265 lines) from all 3 adapters — replaced with imports from shared data files
- Removed local `buildRecord()`, `inferCategory()`, `inferModalities()` from all 3 adapters
- anthropic-models.ts: 501 → 221 lines (−280)
- openai-models.ts: 767 → 186 lines (−581)
- google-models.ts: 606 → 229 lines (−377)
- Total lines eliminated: ~1238 (plus the shared data files save another ~900 lines of duplication)
- Zero behavior change: 65 tests pass, TypeScript clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create createAdapterSyncer() factory** - `7bdc429` (feat)
2. **Task 2: Rewire anthropic, openai, google adapters to use factory** - `b00ab17` (feat)

## Files Created/Modified

- `src/lib/data-sources/shared/adapter-syncer.ts` — `createAdapterSyncer<TApiResult>()` + `AdapterSyncerConfig<TApiResult>` + `getApiResultSize()` helper
- `src/lib/data-sources/adapters/anthropic-models.ts` — PROVIDER_DEFAULTS, boundBuildRecord, tryFetchLiveApi, tryScrapeDocsPage, enrichFromApi, createAdapterSyncer call
- `src/lib/data-sources/adapters/openai-models.ts` — same pattern, ALLOWED_OWNERS filter preserved local
- `src/lib/data-sources/adapters/google-models.ts` — same pattern, context_window update (Pitfall 6) in enrichFn, query-param key in healthCheckUrl
- `src/lib/data-sources/shared/build-record.ts` — return type widened from `ModelRecord` to `Record<string, unknown>`

## Decisions Made

- `AdapterSyncerConfig.healthCheckUrl` supports `string | ((apiKey: string) => string)` to handle Google's query-param API key pattern without duplicating health check logic outside the factory.
- `buildRecord()` return type widened from `ModelRecord` to `Record<string, unknown>` — eliminates the need for double-casts in adapters (`as unknown as Record<string, unknown>`). `ModelRecord` interface remains as documentation.
- Google adapter's `PROVIDER_DEFAULTS` omits all optional fields (category, modalities, is_open_weights, license) — per-model values from `GOOGLE_KNOWN_MODELS` must win to correctly handle Gemma (open_source) vs Gemini (commercial).
- `enrichFn` signature explicitly passes `buildRecordFn` as a parameter — factory remains stateless and pure, easier to test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended healthCheckUrl to support function overload for Google**
- **Found during:** Task 2 (Google adapter rewrite)
- **Issue:** Google passes API key as `?key={apiKey}` query parameter, not a request header. The factory's static `healthCheckUrl` string could not include the dynamic key.
- **Fix:** Changed `AdapterSyncerConfig.healthCheckUrl` from `string` to `string | ((apiKey: string) => string)`. Factory resolves the URL before fetching: `typeof url === "function" ? url(apiKey) : url`. Google adapter uses the function form.
- **Files modified:** `src/lib/data-sources/shared/adapter-syncer.ts`, `src/lib/data-sources/adapters/google-models.ts`
- **Commit:** `b00ab17`

**2. [Rule 1 - Bug] buildRecord() return type widened to Record<string, unknown>**
- **Found during:** Task 2 (Anthropic adapter, TypeScript compile)
- **Issue:** `buildRecord()` returned `ModelRecord` (typed interface without index signature), which TypeScript rejected as not assignable to `Record<string, unknown>` — the type expected by `AdapterSyncerConfig.buildRecordFn` and `Map<string, Record<string, unknown>>`.
- **Fix:** Changed `buildRecord()` return type from `ModelRecord` to `Record<string, unknown>`. The `ModelRecord` interface remains in the file as documentation.
- **Files modified:** `src/lib/data-sources/shared/build-record.ts`
- **Commit:** `b00ab17`

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correct TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the two auto-fixed TypeScript issues documented above.

## User Setup Required

None — no external service configuration required.

## Phase 4 Completion

All 4 ADAPT requirements are now satisfied:
- **ADAPT-01:** KNOWN_MODELS extracted to shared/known-models/*.ts (Plan 01)
- **ADAPT-02:** inferCategory() unified in shared/infer-category.ts (Plan 01)
- **ADAPT-03:** buildRecord() shared factory in shared/build-record.ts (Plan 02)
- **ADAPT-04:** createAdapterSyncer() factory in shared/adapter-syncer.ts (Plan 03)

The 6 affected adapters (anthropic, openai, google, replicate, openrouter, github-trending) all use shared modules. The full Phase 4 deduplication is complete.

---

## Self-Check

### Files Exist

- `src/lib/data-sources/shared/adapter-syncer.ts` — FOUND (createAdapterSyncer exported)
- `src/lib/data-sources/adapters/anthropic-models.ts` — FOUND (uses createAdapterSyncer, 221 lines)
- `src/lib/data-sources/adapters/openai-models.ts` — FOUND (uses createAdapterSyncer, 186 lines)
- `src/lib/data-sources/adapters/google-models.ts` — FOUND (uses createAdapterSyncer, 229 lines)

### Commits Exist

- `7bdc429` — feat(04-03): create createAdapterSyncer() factory
- `b00ab17` — feat(04-03): rewire anthropic, openai, google adapters to use createAdapterSyncer()

## Self-Check: PASSED

---
*Phase: 04-adapter-deduplication*
*Completed: 2026-03-04*
