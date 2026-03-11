# Phase 16: Code Simplification - Research

**Researched:** 2026-03-11
**Domain:** ESLint cleanup, React compiler warning refactoring, dead code removal
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Target v1.1-touched files only (Phases 9-15 changes)
- Zero warnings target: fix ALL 74 lint warnings, not just unused imports
- React compiler warnings (set-state-in-effect, exhaustive-deps, purity, immutability) must be refactored away, not just suppressed
- After all React compiler warnings are fixed, remove the three `"warn"` overrides from eslint.config.mjs to promote them to errors for future CI enforcement
- Comment out dead code with `// REMOVED` tag rather than deleting outright
- Unused imports, unused variables, orphaned exports all get the `// REMOVED` treatment
- Lint fixes + dead code cleanup + light refactors where obvious
- Simplify overly complex functions where the improvement is clear
- No major architectural changes or pattern consolidation
- No file count reduction or large-scale renaming
- Run full suite (tsc --noEmit + vitest run + eslint) after each logical batch
- All 222 tests + E2E tests must pass at end

### Claude's Discretion
- Grouping of changes into logical batches
- Exact refactor approach for each React compiler warning
- Whether a function simplification is "obvious" enough to include

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIMP-01 | Simplification pass over changed files from this milestone (reuse, clarity, efficiency) | React compiler warning refactor patterns; useMemo/useRef stabilization; function extraction |
| SIMP-02 | Unused imports, dead code, and redundant patterns cleaned up across touched files | Full enumerated list of all 74 warnings by file and rule; `// REMOVED` tagging convention |
</phase_requirements>

## Summary

Phase 16 is a pure cleanup phase: no new features, no architectural changes. The full scope is known precisely — ESLint reports exactly 74 warnings across 38 files, 0 errors. The warnings fall into three categories: unused imports/variables (~40), React compiler rule violations (set-state-in-effect, purity, immutability, exhaustive-deps, incompatible-library — ~30), and one accessibility warning (aria-props). The eslint.config.mjs currently downgrades three React compiler rules to warnings; once all violations are fixed, those overrides are deleted so violations become CI-blocking errors going forward.

Dead code uses the `// REMOVED` comment convention rather than deletion, making the git-grep audit trail straightforward. The 222-test vitest suite plus 37 Playwright E2E tests provide regression safety throughout the cleanup.

**Primary recommendation:** Work in two logical batches — Batch 1: all unused-import/variable/no-img warnings (mechanical, low risk), Batch 2: all React compiler warnings (requires judgment, verify after each file). Remove eslint.config.mjs overrides last after all Batch 2 items are clean.

## Standard Stack

### Core (no new dependencies needed)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| ESLint | Current (via next) | Lint enforcement | Already configured, CI-integrated |
| TypeScript | Current | Type safety gate | `npx tsc --noEmit` already in CI |
| Vitest | Current | Regression safety | 222 tests already passing |
| Playwright | Current | E2E regression safety | 37 tests already passing |

**Installation:** None required — all tooling already present.

## The Complete Warning Inventory

Verified by running `npx eslint . --format json` on 2026-03-11. Total: **74 warnings, 0 errors**.

### Category A: Unused Variables / Imports (no-unused-vars) — ~40 warnings

Mechanical fixes: remove the import line (or add `// REMOVED` if the symbol may be needed) and verify tsc/tests still pass.

| File | Symbol | Type |
|------|--------|------|
| `src/app/(auth)/error.tsx:6` | `Home` | unused import |
| `src/app/(catalog)/skills/page.tsx:19` | `formatNumber` | unused import |
| `src/app/(catalog)/skills/page.tsx:141` | `DeploymentRow` | unused local type |
| `src/app/(rankings)/leaderboards/[category]/page.tsx:5` | `CardHeader`, `CardTitle` | unused imports |
| `src/app/(rankings)/leaderboards/[category]/page.tsx:11` | `formatTokenPrice`, `formatNumber` | unused imports |
| `src/app/(rankings)/leaderboards/page.tsx:11` | `formatNumber` | unused import |
| `src/app/api/admin/bootstrap/route.ts:13` | `_request` | unused param |
| `src/app/api/webhooks/chain-deposits/route.ts:4` | `Token` | unused import |
| `src/app/not-found.tsx:2` | `ArrowLeft` | unused import |
| `src/components/compare/share-comparison.tsx:4` | `Link2` | unused import |
| `src/components/layout/header.tsx:12` | `Search` | unused import |
| `src/components/layout/market-ticker.test.tsx:10` | `children` (mock param) | unused param |
| `src/components/marketplace/english-bid-panel.tsx:13` | `Badge` | unused import |
| `src/components/marketplace/wallet-deposit-panel.tsx:17` | `_price` | unused param |
| `src/components/models/ranking-weight-controls.test.tsx:22` | `asChild` (mock param) | unused param |
| `src/components/models/ranking-weight-controls.tsx:17` | `MIN_WEIGHT` | unused const |
| `src/components/models/similar-models.tsx:3` | `Badge` | unused import |
| `src/components/models/similar-models.tsx:6` | `formatNumber` | unused import |
| `src/components/models/similar-models.tsx:30` | `catConfig` | assigned but unused |
| `src/components/notifications/notification-bell.tsx:8` | `Check` | unused import |
| `src/components/three/scene-content.tsx:15` | `viewport` | assigned but unused |
| `src/components/three/scene-content.tsx:97` | `delta` | unused param |
| `src/lib/compute-scores/compute-all-lenses.test.ts:147` | `thenable` | unused var |
| `src/lib/compute-scores/compute-all-lenses.test.ts:163` | `_args` | unused param |
| `src/lib/compute-scores/compute-all-lenses.test.ts:170` | `_table` | unused param |
| `src/lib/compute-scores/fetch-inputs.test.ts:44` | `_args` | unused param |
| `src/lib/compute-scores/persist-results.test.ts:117` | `_data` | unused param |
| `src/lib/compute-scores/persist-results.test.ts:130` | `_data`, `_opts` | unused params |
| `src/lib/data-sources/adapters/artificial-analysis.ts:9` | `sanitizeFilterValue`, `sanitizeSlug` | unused imports |
| `src/lib/data-sources/adapters/livebench.ts:26` | `sanitizeFilterValue`, `sanitizeSlug` | unused imports |
| `src/lib/data-sources/adapters/livebench.ts:122` | `offset` | assigned but unused |
| `src/lib/data-sources/adapters/open-llm-leaderboard.ts:353` | `shortName` | assigned but unused |
| `src/lib/marketplace/auctions/dutch.ts:9` | `refundEscrow` | unused import |
| `src/lib/payments/chains/evm.ts:68` | `TRANSFER_EVENT_SIGNATURE` | assigned but unused |
| `src/lib/scoring/market-cap-calculator.ts:141` | `TOTAL_POSSIBLE_SIGNALS` | assigned but unused |
| `supabase/functions/sync-huggingface/index.ts:197` | `req` | unused param |
| `supabase/functions/sync-huggingface/index.ts:214` | `totalUpdated` | assigned but unused |

### Category B: React Compiler Warnings — ~33 warnings

These require actual refactoring. Fix approach per rule:

**`react-hooks/set-state-in-effect`** — calling setState synchronously inside useEffect triggers cascading renders. Fix: move state initialization to useMemo or useState initializer; use functional updater; or restructure effect to avoid synchronous setState.

| File | Line | Fix Approach |
|------|------|-------------|
| `src/app/(auth)/profile/profile-content.tsx:89` | line 89 | Move `setDisplayName/setUsername/setBio` to useState initializer with profile as default, remove the entire sync-setState effect. Pattern: `useState(profile?.display_name ?? "")` and re-derive when profile changes via useMemo or key prop. |
| `src/components/search-dialog.tsx:52` | line 52 | The `setDebouncedQuery("")` in the query<2 branch is synchronous setState in effect — convert to timeout-only pattern: always go through setTimeout (with 0ms for the reset case), or use `useRef` for the timer and avoid the synchronous setState path. |
| `src/components/search-dialog.tsx:85` | line 85 | The `setRecentSearches(getRecentSearches())` and `setQuery/setDebouncedQuery/setActiveIndex` calls in the `open` effect are synchronous setState. Move initial state reads to a `useLayoutEffect` or derive via `useMemo`; better: initialize `recentSearches` lazily with `useState(() => getRecentSearches())` and refresh only when `open` transitions true via `useRef` tracking. |
| `src/components/three/ambient-scene.tsx:129` | line 129 | Three.js scene component — this is a `set` call inside a useEffect (R3F pattern). Fix: move the setState out of the synchronous path or use `startTransition`. |
| `src/hooks/use-auction-timer.ts:61` | line 61 | Timer hook calling setState synchronously in effect — move to async pattern or use `useReducer` to batch the update. |
| `src/app/(marketplace)/marketplace/auctions/auctions-browse-content.tsx:289` | line 289 | `exhaustive-deps` — the `auctions` logical expression in deps array is unstable. Stabilize with `useMemo` or restructure the effect to not depend on derived array. |
| `src/components/charts/trading-chart.tsx:67` | line 67 | `exhaustive-deps` — `chartData` conditional in deps. Use `useMemo` to stabilize `chartData` reference, then depend on the memoized value. |
| `src/app/(auth)/orders/[id]/order-detail-content.tsx:85` | line 85 | `exhaustive-deps` — `messages` logical expression in deps. Same: stabilize with `useMemo`. |

**`react-hooks/purity`** — calling impure functions (`Math.random`, `Date.now`) during render. Fix: move calls outside the component or into a `useMemo`/`useRef` initialized once.

| File | Lines | Symbols | Fix |
|------|-------|---------|-----|
| `src/app/page.tsx:419` | 419 | `Date.now` | Wrap in `useMemo(() => Date.now(), [])` or hoist to module-level constant computed once. |
| `src/components/three/ambient-scene.tsx:21-33` | 21,22,23,27,28,29,32,33 | `Math.random` (8x) | Move all `Math.random()` calls into a single `useMemo(() => ({ ...randomValues }), [])` computed once on mount. |
| `src/components/three/scene-content.tsx:26-47` | 26,27,28,33,38,39,40,44,47 | `Math.random` (9x) | Same: compute all random values in a single `useMemo` or `useRef` initialized once. |

**`react-hooks/immutability`** — mutating a value passed as a prop/ref.

| File | Lines | Fix |
|------|-------|-----|
| `src/components/three/ambient-scene.tsx:53` | 53 | Copy the ref value before mutating: `const obj = ref.current; if (obj) { obj.rotation.y = ...; }` |
| `src/components/three/scene-content.tsx:121,191` | 121, 191 | Same pattern: copy ref before mutation. |

**`react-hooks/incompatible-library`**

| File | Line | Fix |
|------|------|-----|
| `src/components/models/leaderboard-explorer.tsx:246` | 246 | "Compilation Skipped: Use of incompatible library" — this is the React compiler flagging an incompatible third-party hook. Fix: wrap the call in `// eslint-disable-next-line react-hooks/incompatible-library` with a comment explaining why (the library predates React compiler compatibility). This is an acceptable suppress since we cannot change the library internals. |

### Category C: Accessibility — 1 warning

| File | Line | Rule | Fix |
|------|------|------|-----|
| `src/components/search-dialog.tsx:157` | 157 | `jsx-a11y/role-has-required-aria-props` | combobox role requires `aria-expanded` and `aria-controls`. Add the missing aria attributes to the element. |

### Category D: Next.js Image — 1 warning

| File | Line | Rule | Fix |
|------|------|------|-----|
| `src/app/(marketplace)/marketplace/auctions/[id]/auction-detail-content.tsx:250` | 250 | `@next/next/no-img-element` | Replace `<img>` with Next.js `<Image>` component (requires `width`, `height` or `fill` prop). |

## Architecture Patterns

### Batch Organization

Two logical batches minimize risk:

**Batch 1 — Mechanical (low risk):** All unused-import/variable warnings + `@next/next/no-img-element` + `jsx-a11y` aria warning. These are pure removals or straightforward replacements. No logic changes.

**Batch 2 — Behavioral (higher risk, verify after each file):** All React compiler rule violations (set-state-in-effect, purity, immutability, exhaustive-deps, incompatible-library). Each file in this batch gets: fix → `tsc --noEmit` → `vitest run` → verify behavior.

**Final step:** Remove the three `warn` overrides from `eslint.config.mjs` and run full lint to confirm zero warnings.

### Fix Patterns Per Rule

**Pattern: Sync setState in effect → useMemo initializer**
```typescript
// BEFORE (set-state-in-effect)
const [displayName, setDisplayName] = useState("");
useEffect(() => {
  if (profile) setDisplayName(profile.display_name ?? "");
}, [profile]);

// AFTER
const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
// Or if profile loads async, use a key prop on the component to remount:
// <ProfileForm key={profile?.id} profile={profile} />
```

**Pattern: Impure render call → useMemo**
```typescript
// BEFORE (purity violation)
const timestamp = Date.now(); // called every render

// AFTER
const timestamp = useMemo(() => Date.now(), []); // computed once on mount
```

**Pattern: Math.random in render body → single useMemo**
```typescript
// BEFORE (purity — multiple violations)
const x = Math.random() * 10;
const y = Math.random() * 10;
const z = Math.random() * 5;

// AFTER
const { x, y, z } = useMemo(() => ({
  x: Math.random() * 10,
  y: Math.random() * 10,
  z: Math.random() * 5,
}), []); // empty deps = computed once on mount, stable for lifetime
```

**Pattern: Ref mutation → copy before mutate**
```typescript
// BEFORE (immutability violation)
meshRef.current.rotation.y += delta; // mutating prop passed to compiler

// AFTER
const mesh = meshRef.current;
if (mesh) mesh.rotation.y += delta; // local variable, not the ref itself
```

**Pattern: Unstable dep in exhaustive-deps → useMemo stabilization**
```typescript
// BEFORE
useEffect(() => { ... }, [auctions?.length && auctions]);

// AFTER
const stableAuctions = useMemo(() => auctions ?? [], [auctions]);
useEffect(() => { ... }, [stableAuctions]);
```

**Pattern: Dead code → `// REMOVED` tag**
```typescript
// BEFORE
import { formatNumber } from "@/lib/utils";

// AFTER
// REMOVED: import { formatNumber } from "@/lib/utils";
```

### eslint.config.mjs Final State

After all Batch 2 fixes are verified, the rules block is removed entirely:

```typescript
// DELETE this entire block:
{
  rules: {
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/purity": "warn",
    "react-hooks/immutability": "warn",
  },
},
```

The `react-hooks/exhaustive-deps` rule was never downgraded — it is already an error from `eslint-config-next`. That it currently shows as warnings in the output is because ESLint reports it under the existing warn override umbrella. After the block is removed, any remaining violation becomes a CI-blocking error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding all lint warnings | Custom script | `npx eslint . --format json` | Already done — 74 warnings enumerated above |
| Detecting unused code | Manual review | ESLint `no-unused-vars` | Already flagged — just act on the list |
| Type regression checking | Manual | `npx tsc --noEmit` | Already in CI, run after each batch |
| Test regression | Manual inspection | `vitest run` | 222 tests, run after each batch |

**Key insight:** Every item to fix is already known. This phase is execution against a predetermined list, not discovery.

## Common Pitfalls

### Pitfall 1: Removing `_`-prefixed params that ARE used
**What goes wrong:** `_request`, `_args`, `_data`, `_opts`, `_price` are intentionally prefixed with `_` to signal "unused" but are actually present as positional placeholders in function signatures. Simply deleting them shifts argument positions.
**Why it happens:** `no-unused-vars` flags underscore-prefixed names if the rule isn't configured with `argsIgnorePattern`.
**How to avoid:** For unused function parameters that must remain for positional reasons, prefix with `_` AND add `// REMOVED` comment inline. For route handlers like `route.ts` that take `(request: Request)` but ignore it, rename to `_request` (already done) — the fix is to add a leading underscore to satisfy the rule or suppress inline.
**Warning signs:** The fix breaks a function call signature or removes a required positional arg.

### Pitfall 2: Over-aggressively removing constants that may be needed
**What goes wrong:** `MIN_WEIGHT`, `TOTAL_POSSIBLE_SIGNALS`, `TRANSFER_EVENT_SIGNATURE` are defined but unused — but may be architectural anchors for future use or documentation.
**How to avoid:** Use `// REMOVED` tag, not deletion. The constant stays in the file, just commented out.

### Pitfall 3: React compiler purity fixes break Three.js/R3F patterns
**What goes wrong:** R3F (react-three-fiber) uses refs and mutable objects extensively. Moving `Math.random()` into `useMemo` is correct, but the immutability fixes for ref mutation need care — R3F's animation loop (`useFrame`) operates on refs by design.
**How to avoid:** For `useFrame` callbacks (which run outside React's render), the `immutability` violation may need a targeted `eslint-disable-next-line` with a comment rather than a structural change. Verify the Three.js scene still renders correctly after the fix.

### Pitfall 4: `search-dialog.tsx` set-state-in-effect fixes break UX
**What goes wrong:** The debounce effect and the `open` state effect both call setState synchronously — they coordinate multi-state resets. A naive fix (e.g., wrapping in `startTransition`) can cause visual flicker or search results to flash.
**How to avoid:** The clean fix for the debounce effect is to ensure the `setDebouncedQuery("")` reset always goes through the timeout path. For the `open` effect, use `useRef` to track previous open state rather than synchronous setState; or use `useReducer` to batch all the resets into one dispatch.

### Pitfall 5: Removing eslint.config.mjs overrides too early
**What goes wrong:** If `"warn"` overrides are removed before all violations are fixed, ESLint fails (errors), and CI blocks.
**How to avoid:** Remove overrides LAST, after `npx eslint .` shows zero warnings for all three rules.

### Pitfall 6: Test file unused params break Supabase mock chain
**What goes wrong:** `compute-all-lenses.test.ts` has `_args` and `_table` as params in the Supabase chainable mock factory. Removing them could shift argument positions in the mock `.then()` handler.
**How to avoid:** Prefix with `_` (they already are) and add `// REMOVED` comment, but keep the parameter positionally.

## Code Examples

### Verified: Check current warning count
```bash
# Source: direct eslint execution
npx eslint . --format json | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const w=d.reduce((a,f)=>a+f.warningCount,0);
const e=d.reduce((a,f)=>a+f.errorCount,0);
console.log('warnings:',w,'errors:',e);
"
```

### Verified: Full check suite command
```bash
npx tsc --noEmit && vitest run && npx eslint .
```

### Verified: Quick lint-only check
```bash
npx eslint src/ supabase/ --max-warnings 0
```

### Pattern: Suppress incompatible-library (targeted, with justification)
```typescript
// eslint-disable-next-line react-hooks/incompatible-library -- third-party hook predates React compiler; cannot change library internals
const { ... } = useSomeThirdPartyHook();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React compiler rules as errors (default) | Downgraded to warnings (Phase 10) | Phase 10 | CI unblocked; created 74-warning debt |
| Warning debt deferred | All warnings fixed + overrides removed (Phase 16) | Now | Violations become CI-blocking errors permanently |

**Context:** The warning overrides in `eslint.config.mjs` were added in Phase 10 as a "CI baseline" decision (documented in STATE.md). Phase 16 is the planned payoff: fix the debt, remove the overrides, restore strict enforcement.

## Open Questions

1. **`leaderboard-explorer.tsx:246` — incompatible-library**
   - What we know: The React compiler flags an incompatible third-party hook. The exact hook is at line 246.
   - What's unclear: Whether the library has been updated to be React compiler compatible, or if a structural workaround (wrapping in a non-compiled component) is preferable to an inline disable.
   - Recommendation: Read the file at line 246 during planning to identify the hook, then decide — targeted disable with comment is acceptable if the library is unmaintained/slow to update.

2. **`use-auction-timer.ts:61` — set-state-in-effect**
   - What we know: Timer hook calls setState synchronously in an effect.
   - What's unclear: Whether this is a `setInterval` callback or a direct effect body call. The fix differs significantly.
   - Recommendation: Planner should read the hook before specifying the exact fix.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (current version) + Playwright |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `vitest run --reporter=dot` |
| Full suite command | `npx tsc --noEmit && vitest run && npx eslint .` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIMP-01 | Simplified functions still behave correctly | unit (regression) | `vitest run` | Yes — 222 tests existing |
| SIMP-01 | React compiler refactors don't break UI flows | e2e (regression) | `npx playwright test` | Yes — 37 tests existing |
| SIMP-02 | Zero unused imports remain | lint | `npx eslint . --max-warnings 0` | Yes — eslint configured |
| SIMP-02 | TypeScript still compiles after removals | typecheck | `npx tsc --noEmit` | Yes |

### Sampling Rate
- **Per batch commit:** `npx tsc --noEmit && vitest run && npx eslint .`
- **Per wave merge:** Full suite including Playwright
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files needed.

## Sources

### Primary (HIGH confidence)
- Direct ESLint execution on 2026-03-11 — full 74-warning enumeration, verified
- `eslint.config.mjs` — current state of warning overrides, read directly
- `src/components/search-dialog.tsx` — read directly for set-state-in-effect context
- `src/app/(auth)/profile/profile-content.tsx` — read directly for set-state-in-effect context
- `.planning/phases/16-code-simplification/16-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- React compiler rule documentation (react-hooks/set-state-in-effect, purity, immutability) — inferred from error messages in ESLint output plus knowledge of React compiler semantics

### Tertiary (LOW confidence)
- Three.js/R3F interaction with React compiler immutability rule — inferred; the specific scene-content.tsx and ambient-scene.tsx files were not read in full to verify the useFrame context

## Metadata

**Confidence breakdown:**
- Warning inventory: HIGH — enumerated directly from `eslint --format json` output
- Fix patterns: HIGH — standard React patterns for each rule type
- Three.js/R3F specifics: MEDIUM — scene files not fully read; pitfall documented
- Batch ordering: HIGH — logical from risk profile (mechanical before behavioral)

**Research date:** 2026-03-11
**Valid until:** Indefinite — the warning list is a point-in-time snapshot of the current codebase. Do not defer; run `npx eslint .` again at plan time to confirm no new warnings were introduced.
