---
phase: 04-adapter-deduplication
plan: 02
subsystem: api
tags: [typescript, data-sources, refactoring, buildRecord, adapters, tdd]

# Dependency graph
requires:
  - "04-01: KnownModelMeta, ProviderDefaults, inferCategory, REPLICATE_KNOWN_MODELS"
provides:
  - "buildRecord() factory in shared/build-record.ts"
  - "ModelRecord return type in shared/build-record.ts"
  - "replicate.ts rewired to REPLICATE_KNOWN_MODELS + shared inferCategory (description mode)"
  - "openrouter-models.ts rewired to shared inferCategory (arch mode)"
  - "github-trending.ts rewired to shared inferCategory (topics mode)"
affects:
  - "04-03-PLAN.md (adapter-syncer factory consumes buildRecord())"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildRecord() factory: resolution order knownData → overrides → ProviderDefaults (provider fields always win)"
    - "TDD RED/GREEN/REFACTOR for shared factory function"
    - "ProviderDefaults.category skips inferCategory ID mode when set (e.g. Anthropic always multimodal)"
    - "ProviderDefaults.modalities skips inferModalities when set (e.g. Anthropic always [text, image])"

key-files:
  created:
    - "src/lib/data-sources/shared/build-record.test.ts"
  modified:
    - "src/lib/data-sources/shared/build-record.ts"
    - "src/lib/data-sources/adapters/replicate.ts"
    - "src/lib/data-sources/adapters/openrouter-models.ts"
    - "src/lib/data-sources/adapters/github-trending.ts"

key-decisions:
  - "buildRecord() uses 'license_name' in defaults check to distinguish explicit null from not provided (avoids overriding knownData when ProviderDefaults omits it)"
  - "replicate.ts transformKnownModel and transformModel kept as local functions — Replicate-specific transform logic not suitable for buildRecord() factory"
  - "replicate.ts excluded from buildRecord() factory path per user decision (Plan 03 will factory-ize other adapters)"

requirements-completed: [ADAPT-02, ADAPT-03]

# Metrics
duration: 7min
completed: 2026-03-04
---

# Phase 4 Plan 02: buildRecord() Factory and 3 Adapter Rewires Summary

**buildRecord() factory function with ModelRecord return type (10 tests), plus replicate/openrouter/github-trending rewired to shared inferCategory and shared REPLICATE_KNOWN_MODELS — 65 total tests passing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T05:59:54Z
- **Completed:** 2026-03-04T06:06:34Z
- **Tasks:** 2 of 2
- **Files modified:** 1 created, 4 modified

## Accomplishments

- Implemented `buildRecord()` factory in `shared/build-record.ts` with full resolution-order logic (knownData → overrides → ProviderDefaults)
- Added `ModelRecord` return type for type-safe DB record construction
- 10 unit tests covering: Anthropic-style hardcoded category/modalities, OpenAI-style ID-based inference, override precedence, unknown model fallback, slug shape, ISO timestamp, context_window/release_date propagation
- Removed 245-line inline `KNOWN_MODELS` array + `KnownModel` interface from `replicate.ts` — replaced with `REPLICATE_KNOWN_MODELS` import from shared data file
- Removed local `inferCategory()` functions from all 3 target adapters (~64 lines total eliminated)
- Zero behavior change: TypeScript clean, 65 tests pass (55 infer-category + 10 build-record)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement buildRecord() factory with TDD (RED → GREEN)** - `ba59844` (feat)
2. **Task 2: Rewire replicate, openrouter, github-trending to shared modules** - `05c8b2d` (feat)

## Files Created/Modified

- `src/lib/data-sources/shared/build-record.ts` — added buildRecord() + ModelRecord; imports inferCategory/inferModalities + makeSlug
- `src/lib/data-sources/shared/build-record.test.ts` — 10 unit tests (all passing)
- `src/lib/data-sources/adapters/replicate.ts` — removed inline KNOWN_MODELS + KnownModel + local inferCategory; imports REPLICATE_KNOWN_MODELS + shared inferCategory (description mode)
- `src/lib/data-sources/adapters/openrouter-models.ts` — removed local inferCategory; imports shared inferCategory (arch mode)
- `src/lib/data-sources/adapters/github-trending.ts` — removed local inferCategory; imports shared inferCategory (topics mode)

## Decisions Made

- `buildRecord()` uses `"license_name" in defaults` check to distinguish between ProviderDefaults explicitly setting `license_name: null` (wins) vs. ProviderDefaults omitting it (falls back to knownData).
- `replicate.ts` keeps local `transformKnownModel()` and `transformModel()` — these are Replicate-specific transform shapes not suitable for the generic `buildRecord()` factory. Replicate is excluded from factory-ization per user decision (Plan 03 scope).
- TDD RED phase written before GREEN: confirmed 10 tests failed with "buildRecord is not a function" before implementation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `buildRecord()` is ready for Plan 03's adapter-syncer factory pattern
- All 3 non-factory adapters now use shared inferCategory (4-mode dispatch)
- Foundation for Plan 03 is complete: shared types, data files, inferCategory, buildRecord all in place
- No blockers

---

## Self-Check

### Files Exist

- `src/lib/data-sources/shared/build-record.ts` — FOUND (contains buildRecord export)
- `src/lib/data-sources/shared/build-record.test.ts` — FOUND (10 tests)
- `src/lib/data-sources/adapters/replicate.ts` — FOUND (uses REPLICATE_KNOWN_MODELS)
- `src/lib/data-sources/adapters/openrouter-models.ts` — FOUND (uses shared inferCategory arch mode)
- `src/lib/data-sources/adapters/github-trending.ts` — FOUND (uses shared inferCategory topics mode)

### Commits Exist

- `ba59844` — feat(04-02): implement buildRecord() factory with 10 passing tests
- `05c8b2d` — feat(04-02): rewire replicate, openrouter, github-trending to shared modules

## Self-Check: PASSED

---
*Phase: 04-adapter-deduplication*
*Completed: 2026-03-04*
