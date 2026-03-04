---
phase: 04-adapter-deduplication
plan: 01
subsystem: api
tags: [typescript, data-sources, refactoring, inference, adapters]

# Dependency graph
requires: []
provides:
  - "KnownModelMeta unified interface in shared/build-record.ts"
  - "ProviderDefaults type in shared/build-record.ts"
  - "ANTHROPIC_KNOWN_MODELS in shared/known-models/anthropic.ts (11 models)"
  - "OPENAI_KNOWN_MODELS in shared/known-models/openai.ts (27 models)"
  - "GOOGLE_KNOWN_MODELS in shared/known-models/google.ts (13 models)"
  - "REPLICATE_KNOWN_MODELS + KnownReplicateModel in shared/known-models/replicate.ts (29 models)"
  - "inferCategory() with 4 modes (id/description/arch/topics) in shared/infer-category.ts"
  - "inferModalities() in shared/infer-category.ts"
affects:
  - "04-02-PLAN.md (buildRecord factory consumes KnownModelMeta + ProviderDefaults)"
  - "04-03-PLAN.md (adapter-syncer + rewiring imports shared/known-models/* and shared/infer-category.ts)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shared/ directory alongside adapters/ for reusable data files and logic modules"
    - "KnownModelMeta as superset interface with optional fields enabling per-provider customization"
    - "mode-dispatch pattern for inferCategory() — required mode parameter forces caller intent"
    - "data files are pure TypeScript (not JSON) with named exports (no barrel index.ts)"

key-files:
  created:
    - "src/lib/data-sources/shared/build-record.ts"
    - "src/lib/data-sources/shared/infer-category.ts"
    - "src/lib/data-sources/shared/infer-category.test.ts"
    - "src/lib/data-sources/shared/known-models/anthropic.ts"
    - "src/lib/data-sources/shared/known-models/openai.ts"
    - "src/lib/data-sources/shared/known-models/google.ts"
    - "src/lib/data-sources/shared/known-models/replicate.ts"
  modified: []

key-decisions:
  - "vitest globals: false — tests must explicitly import { describe, it, expect } from 'vitest'"
  - "gpt-image prefix must appear before gpt- in ID_PREFIX_CATEGORY to prevent gpt- swallowing gpt-image-1"
  - "topics mode llm keywords include 'language model' (spaced) and 'chat' in addition to 'language-model' (hyphenated)"
  - "Replicate KNOWN_MODELS stays as KnownReplicateModel[] array (not Record) matching its adapter's .map() iteration pattern"
  - "inferCategory module has no import from build-record.ts — accepts primitives only to avoid circular deps (Pitfall 5)"

patterns-established:
  - "Pattern: infer-category.ts is a standalone module with no data-sources imports — reduces circular dependency risk"
  - "Pattern: known-models data files import only type KnownModelMeta from ../build-record (type-only import, zero runtime cost)"

requirements-completed: [ADAPT-01, ADAPT-02]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 4 Plan 01: Shared Types, Data Files, and inferCategory Module Summary

**Unified KnownModelMeta interface + 4 known-model data files (80 models total) + inferCategory/inferModalities with 4-mode dispatch, 55 tests passing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T04:49:52Z
- **Completed:** 2026-03-04T04:56:13Z
- **Tasks:** 2 of 2
- **Files modified:** 7 created

## Accomplishments

- Created `src/lib/data-sources/shared/` directory with the foundation types layer
- Extracted KNOWN_MODELS static data from 4 adapters into dedicated shared data files (80 total models: 11 Anthropic, 27 OpenAI, 13 Google, 29 Replicate)
- Unified 5 disparate `inferCategory()` implementations into a single mode-dispatched function with `ID_PREFIX_CATEGORY`, `DESC_KEYWORD_CATEGORY`, and `TOPICS_KEYWORD_CATEGORY` inline maps
- Merged 2 `inferModalities()` implementations (OpenAI + Google) into one function
- 55 unit tests pass covering all 4 modes + edge cases (null description, empty topics, unknown IDs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KnownModelMeta interface, data files, and inferCategory module** - `acb92bc` (feat)
2. **Task 2: Test inferCategory and inferModalities** - `07fb502` (test + fix)

_Note: Task 2 includes 2 auto-fixes committed together with the test file_

## Files Created/Modified

- `src/lib/data-sources/shared/build-record.ts` — KnownModelMeta interface + ProviderDefaults type (no buildRecord() yet — Plan 02)
- `src/lib/data-sources/shared/infer-category.ts` — Unified inferCategory (4 modes) + inferModalities
- `src/lib/data-sources/shared/infer-category.test.ts` — 55 unit tests (all passing)
- `src/lib/data-sources/shared/known-models/anthropic.ts` — 11 Claude models (category/modalities omitted — set by ProviderDefaults)
- `src/lib/data-sources/shared/known-models/openai.ts` — 27 OpenAI models (exact copy with full fields)
- `src/lib/data-sources/shared/known-models/google.ts` — 13 Google models (exact copy with full fields)
- `src/lib/data-sources/shared/known-models/replicate.ts` — 29 Replicate models as KnownReplicateModel[] array

## Decisions Made

- Vitest `globals: false` in vitest.config.ts — tests must explicitly import `{ describe, it, expect }` from `"vitest"`.
- `gpt-image` prefix placed before `gpt-` in `ID_PREFIX_CATEGORY` to prevent the broad `gpt-` prefix from matching `gpt-image-1` first.
- Topics mode LLM keywords extended to include `"language model"` (spaced) and `"chat"` (not just `"language-model"` hyphenated and `"chatbot"`).
- Replicate data kept as `KnownReplicateModel[]` — the Replicate adapter uses `.map()` not `Object.keys()`, so converting to a `Record` would be a behavior change.
- `infer-category.ts` has zero imports from `build-record.ts` — avoids the circular dependency pitfall identified in RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ID_PREFIX_CATEGORY ordering for gpt-image**
- **Found during:** Task 2 (test execution revealed 1 failing test)
- **Issue:** `"gpt-"` prefix appeared before `"gpt-image"` in the array, causing `gpt-image-1` to match as `"llm"` instead of `"image_generation"`
- **Fix:** Reordered `ID_PREFIX_CATEGORY` to place `"gpt-image"` entry before `"gpt-"` entry
- **Files modified:** `src/lib/data-sources/shared/infer-category.ts`
- **Verification:** Test `returns "image_generation" for "gpt-image-1"` passes
- **Committed in:** `07fb502` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed topics mode keyword map for llm category**
- **Found during:** Task 2 (test execution revealed 1 failing test)
- **Issue:** `TOPICS_KEYWORD_CATEGORY` used `"language-model"` (hyphenated) and `"chatbot"` for the llm case, but description "language model for chat" (spaced "language model" + "chat") didn't match any keyword
- **Fix:** Added `"language model"` (spaced) and `"chat"` to the llm keywords list in `TOPICS_KEYWORD_CATEGORY`
- **Files modified:** `src/lib/data-sources/shared/infer-category.ts`
- **Verification:** Test `handles missing topics gracefully` passes
- **Committed in:** `07fb502` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Vitest `globals: false` requires explicit imports — initial test run failed with `ReferenceError: describe is not defined`. Fixed by adding `import { describe, it, expect } from "vitest"` to the test file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation layer complete for Plan 02 (buildRecord factory)
- `KnownModelMeta` and `ProviderDefaults` types ready for consumption by `buildRecord()`
- All 4 provider data files ready for import by their respective adapters
- `inferCategory` and `inferModalities` ready for use in `buildRecord()` and adapter rewiring (Plan 03)
- No blockers

---
*Phase: 04-adapter-deduplication*
*Completed: 2026-03-04*
