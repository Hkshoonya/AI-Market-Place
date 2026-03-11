# Phase 16: Code Simplification - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Final cleanup pass over all code touched during v1.1 milestone (Phases 9-15). Remove dead code, fix all lint warnings including React compiler warnings, and apply light refactors for clarity. No new features, no architectural changes.

</domain>

<decisions>
## Implementation Decisions

### Cleanup Scope
- Target v1.1-touched files only (Phases 9-15 changes)
- Zero warnings target: fix ALL 74 lint warnings, not just unused imports
- React compiler warnings (set-state-in-effect, exhaustive-deps, purity) must be refactored away, not just suppressed
- After all React compiler warnings are fixed, remove the warning downgrade overrides from eslint.config.mjs to promote them to errors for future CI enforcement

### Dead Code Handling
- Comment out dead code with `// REMOVED` tag rather than deleting outright
- Unused imports, unused variables, orphaned exports all get this treatment
- Git history preserves full code, but `// REMOVED` tag makes grep easy for review

### Simplification Criteria
- Lint fixes + dead code cleanup + light refactors where obvious
- Simplify overly complex functions where the improvement is clear
- No major architectural changes or pattern consolidation
- No file count reduction or large-scale renaming

### Verification Strategy
- Run full suite (tsc --noEmit + vitest run + eslint) after each logical batch
- Catch regressions early rather than batching everything
- All 222 tests + E2E tests must pass at end

### Claude's Discretion
- Grouping of changes into logical batches
- Exact refactor approach for each React compiler warning
- Whether a function simplification is "obvious" enough to include

</decisions>

<specifics>
## Specific Ideas

- React compiler warnings exist in: profile-content.tsx, search-dialog.tsx, trading-chart.tsx, auctions-browse-content.tsx, page.tsx (Date.now purity)
- ~20 unused import warnings across various files
- eslint.config.mjs currently has `react-hooks/set-state-in-effect: "warn"`, `react-hooks/purity: "warn"`, `react-hooks/immutability: "warn"` — these should be removed (reverted to default error level) once all warnings are fixed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing component tests (222 total) provide regression safety for refactors
- E2E tests (37 passing) verify end-to-end flows after changes

### Established Patterns
- `eslint-disable` at file top for test mock files (Phase 12/15 pattern)
- useMemo for stabilizing array refs (Phase 13 pattern)
- SWR hooks replace useState+useEffect+fetch (Phase 14 pattern)

### Integration Points
- eslint.config.mjs warning downgrades to be removed
- CI workflow enforces lint/typecheck/test — zero errors required

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-code-simplification*
*Context gathered: 2026-03-11*
