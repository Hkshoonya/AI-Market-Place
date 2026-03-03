# Phase 1: Test Infrastructure + Constants - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure Vitest with TypeScript support and path aliases. Extract all magic numbers, thresholds, and provider estimates from scoring calculators into named constants. No behavior changes — just moving values to a centralized location and setting up the test runner.

</domain>

<decisions>
## Implementation Decisions

### Constants location
- New file: `src/lib/constants/scoring.ts` — alongside existing constants files (benchmarks.ts, providers.ts, categories.ts, site.ts, marketplace.ts)
- Follow established UPPER_SNAKE_CASE naming convention
- All scoring phases (2-8) import from this single file

### Constants to extract
- Market cap: `MARKET_CAP_SCALE_FACTOR` (1300), `USAGE_EXPONENT` (1.2), `MAX_PRICE_NORMALIZATION` (20)
- Coverage penalties: lookup table `COVERAGE_PENALTY` mapping signal count → factor (e.g., `{0: 0, 1: 0.40, 2: 0.65, 3: 0.85, 4: 1.0}`)
- Provider MAU estimates: `PROVIDER_USAGE_ESTIMATES` object in same `scoring.ts` file — TypeScript object, not JSON, not database

### Vitest configuration
- Colocated test files: `*.test.ts` next to source files (e.g., `scoring/quality-calculator.test.ts`)
- TypeScript support with path alias `@/*` matching tsconfig
- No coverage thresholds initially — Phase 8 adds actual tests

### Claude's Discretion
- Exact Vitest config options (reporters, globals, environment)
- Whether to add a `test` script to package.json (yes, obviously)
- Any vitest workspace config if needed

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard Vitest setup and mechanical constant extraction.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/constants/` directory: 5 existing constants files following UPPER_SNAKE_CASE pattern
- `tsconfig.json`: path alias `@/*` → `./src/*` already configured

### Established Patterns
- Constants naming: UPPER_SNAKE_CASE (see `RATE_LIMITS`, `PROTECTED_ROUTES` in existing code)
- File naming: kebab-case for all files
- Exports: named exports, no default exports

### Integration Points
- Magic numbers in: `market-cap-calculator.ts`, `quality-calculator.ts`, `expert-calculator.ts`, `usage-calculator.ts`, `agent-score-calculator.ts`
- Provider MAU estimates in: `market-cap-calculator.ts`, `usage-calculator.ts`
- Coverage penalty thresholds in: `quality-calculator.ts`, `expert-calculator.ts`, `market-cap-calculator.ts`, `agent-score-calculator.ts`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-test-infrastructure-constants*
*Context gathered: 2026-03-03*
