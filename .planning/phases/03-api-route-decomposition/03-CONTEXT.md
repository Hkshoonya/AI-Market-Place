# Phase 3: API Route Decomposition - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the 612-line compute-scores cron route and 327-line purchase route into independently testable functions. Route files become thin HTTP wrappers. All business logic lives in extracted functions that can be imported and tested without a Next.js server. Zero behavior change — all scoring output, purchase flows, and HTTP responses must be identical before and after.

</domain>

<decisions>
## Implementation Decisions

### File organization
- Compute-scores functions go in a new `src/lib/compute-scores/` directory (dedicated directory, mirrors how `src/lib/scoring/` groups calculator logic)
- Purchase functions go in `src/lib/marketplace/purchase-handlers.ts` (alongside existing escrow.ts and delivery.ts)
- Route files (`route.ts`) become pure thin wrappers: auth check, parse request, call extracted function, format HTTP response. All business logic lives in the extracted functions

### Compute-scores pipeline boundaries
- Three main functions: `fetchInputs()`, `computeAllLenses()`, `persistResults()`
- Pricing sync and value metric computation are part of `computeAllLenses()` — they're intermediate scoring steps that feed into market cap and rankings
- Pipeline health check (stale data warning) belongs inside `fetchInputs()` — validates data freshness at fetch time, returns stale count as part of the fetch result
- `computeAllLenses()` is a single public function that internally delegates to existing per-lens calculators (capability, usage, expert, balanced, agent, market-cap). Not 6 separate exported lens functions

### Purchase route split strategy
- Shared sub-steps with thin branching: both `handleGuestCheckout()` and `handleAuthenticatedCheckout()` call shared sub-functions (createOrder, executeDelivery, completeEscrow)
- Each handler orchestrates the flow differently: guest skips wallet/escrow, auth includes balance check
- Guest dedup check (preventing re-download) moves inside `handleGuestCheckout()` — it's guest-specific business logic, makes it independently testable
- Leave `const sb = admin as any` for Phase 6 (Type Safety) — Phase 3 scope is decomposition only

### Function interfaces
- Parameter injection for Supabase client: each function takes Supabase client as first parameter (e.g., `fetchInputs(supabase)`). Tests pass mock client. Matches existing pattern in escrow.ts/delivery.ts
- `fetchInputs()` returns a single typed `ScoringInputs` object with all maps: `{ models, benchmarkMap, eloMap, newsMentionMap, providerBenchmarkAvg, ... }`. `computeAllLenses()` takes this as input
- `computeAllLenses()` returns a typed `ScoringResults` object with all score/rank maps: `{ capabilityScores, usageScores, expertScores, balancedRankings, marketCaps, agentScores, ... }`. `persistResults()` takes this directly
- Clean data contracts between pipeline phases: ScoringInputs -> ScoringResults -> persistence

### Claude's Discretion
- Exact type definitions for ScoringInputs and ScoringResults interfaces
- Internal structure of computeAllLenses() sub-calls
- Naming of shared purchase sub-functions (createOrder, executeDelivery, etc.)
- Whether persistResults() handles both model updates and snapshots or splits them
- Error handling within extracted functions (return errors or throw)

</decisions>

<specifics>
## Specific Ideas

- The pipeline should read as: `const inputs = await fetchInputs(supabase)` -> `const results = computeAllLenses(inputs)` -> `await persistResults(supabase, results)` in the route handler
- Each function should be callable from a Vitest test with mock data — no NextRequest/NextResponse dependencies in extracted functions
- This is pure structural refactoring, same patterns as Phase 2 (extract functions, zero behavior change)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/marketplace/escrow.ts`: Already uses parameter injection for Supabase — good pattern to follow
- `src/lib/marketplace/delivery.ts`: deliverDigitalGood() is already extracted — purchase handlers can call it directly
- `src/lib/auth/resolve-user.ts`: resolveAuthUser() already extracted — stays in route as HTTP-layer concern
- All 7 scoring calculators (quality, usage, expert, capability, balanced, agent, market-cap): Already importable functions, computeAllLenses() will orchestrate them

### Established Patterns
- Signal accumulation: calculators take typed inputs + normalization stats, return scores
- Normalization stats computed first from full model list, then passed to per-model scoring
- Batch persistence: 50-model batches with Promise.all for parallel upserts
- Rate limiting + auth check at route level, business logic in lib/

### Integration Points
- `src/app/api/cron/compute-scores/route.ts` (612 lines) -> extract to `src/lib/compute-scores/`
- `src/app/api/marketplace/purchase/route.ts` (327 lines) -> extract to `src/lib/marketplace/purchase-handlers.ts`
- Existing calculator imports stay the same — computeAllLenses() wraps them
- `trackCronRun()` stays in route handler (HTTP-level concern)

### Key Dependencies
- compute-scores imports from: scoring calculators (7), provider-pricing, constants/scoring, pipeline-health, cron-tracker
- purchase imports from: rate-limit, payments/wallet, marketplace/escrow, marketplace/delivery, supabase/admin, auth/resolve-user

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-api-route-decomposition*
*Context gathered: 2026-03-04*
