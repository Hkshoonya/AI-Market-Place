# Phase 19: Tech Debt Hardening - Research

**Researched:** 2026-03-11
**Domain:** npm dependency hygiene, ESLint CI configuration, dead code removal
**Confidence:** HIGH

## Summary

Phase 19 closes four concrete gaps identified in the v1.1 re-audit. All four items are mechanical, low-risk changes with no design ambiguity. The research required inspecting the actual state of the codebase rather than exploring external libraries or patterns — this is "verify and act" work, not "discover and design" work.

Two of the four audit items are already partially or fully resolved: the `useEffect` import in `listing-reviews.tsx` was removed when SWR conversion was completed in Phase 14, and `npm run lint -- --max-warnings 0` already exits with code 0. The remaining work is: (1) explicitly declaring `msw` as a direct devDependency in `package.json`, (2) changing the `lint` script in `package.json` to include `--max-warnings 0`, (3) deleting the orphaned `src/lib/schemas/index.ts` barrel file, and (4) confirming (no action needed) on `useEffect`.

**Primary recommendation:** One plan, four targeted changes — all in `package.json` and one file deletion. Estimated execution time under 10 minutes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-03 | E2E test for model detail page (view model, check scores, navigate tabs) | MSW devDep declaration hardens the fixture infrastructure that makes E2E-03 run in CI |
| E2E-06 | E2E tests integrated into CI pipeline | MSW devDep ensures `npm ci` in CI installs MSW reliably, not via transitive dep |
| CICD-01 | GitHub Actions workflow runs lint on every PR | `--max-warnings 0` in lint script makes CICD-01 meaningfully enforce zero-warning policy |
| SIMP-01 | Simplification pass over changed files | Deleting orphaned barrel and confirmed-unused import completes simplification |
| SIMP-02 | Unused imports, dead code, and redundant patterns cleaned up | Same as above — barrel deletion is dead code removal |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| msw | 2.12.10 (already in lockfile) | Mock Service Worker — HTTP interception for E2E tests | Currently used by Phase 18 MSW infrastructure; needs to be explicit devDep |
| eslint | ^9 (already installed) | JS/TS linting | Already in devDependencies; only the lint script changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| npm install -D | built-in | Add direct devDependency | When a package is used directly by project code but only appears transitively |

**No new packages are required.** MSW 2.12.10 is already installed (via shadcn transitive dep, `dev: true` in lockfile). Running `npm install -D msw` will promote it to a direct devDependency in `package.json` without changing its version.

**Installation:**
```bash
npm install -D msw
```

## Architecture Patterns

### Current State vs. Target State

#### INT-MSW-DEP: MSW not a direct devDependency

**Current state:**
- `package.json` devDependencies: no `msw` entry
- `package-lock.json`: `msw@2.12.10` present with `dev: true` (installed via `shadcn` transitive chain)
- `e2e/mocks/server.ts` imports from `msw/node`
- `e2e/mocks/handlers.ts` imports from `msw`

**Problem:** If `shadcn` removes or changes its MSW dependency, `npm ci` would silently drop MSW, breaking CI E2E tests with a cryptic import-not-found error — not a clear "dependency missing" error.

**Target state:**
- `package.json` devDependencies includes `"msw": "^2.12.10"` (or `"^2"`)
- Version pinned to match the lockfile-installed version

**Fix:** `npm install -D msw` from project root. This updates `package.json` and updates the lockfile entry from transitive to direct.

#### INT-LINT-GATE: Lint script missing --max-warnings 0

**Current state (package.json):**
```json
"lint": "eslint"
```
**CI workflow (`ci.yml`):**
```yaml
- run: npm run lint
```

**Problem:** `eslint` without `--max-warnings 0` exits with code 0 even when warnings exist. ESLint warnings (e.g., `@typescript-eslint/no-unused-vars` set to `"warn"`) silently pass CI. The zero-warning baseline established in Phase 16 is not enforced.

**Verified:** Running `npm run lint -- --max-warnings 0` currently exits with code 0, meaning there are zero current warnings. Adding the flag to the script is safe — it will not break existing CI.

**Target state (package.json):**
```json
"lint": "eslint --max-warnings 0"
```

No change to `ci.yml` needed — CI runs `npm run lint` which will now include the flag.

#### SIMP-02: Orphaned schemas barrel file

**Current state:**
- `src/lib/schemas/index.ts` exists with 9 lines of re-exports
- Zero callers in `src/` import from `@/lib/schemas` or `@/lib/schemas/index`
- All 40+ callers import from sub-paths: `@/lib/schemas/parse`, `@/lib/schemas/marketplace`, etc.
- Confirmed by exhaustive grep across all `.ts`/`.tsx` files in `src/`

**Target state:** File deleted.

**Risk:** None. TypeScript will catch any missed callers at compile time via `npx tsc --noEmit`.

#### SIMP-02: Unused useEffect import (already resolved)

**Audit claim:** `listing-reviews.tsx` has an unused `useEffect` import.
**Current state verified:** `listing-reviews.tsx` imports only `useState` from React. No `useEffect` import present.
**Conclusion:** Already resolved during Phase 14 SWR conversion. No action required.

**This item should be marked as pre-resolved in the plan's summary.**

### Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Direct devDep declaration | Manual package.json edit | `npm install -D msw` | npm handles version resolution, lockfile update, and metadata correctly |

## Common Pitfalls

### Pitfall 1: Version Pinning After npm install -D

**What goes wrong:** `npm install -D msw` might install a newer version than the currently-transitive 2.12.10 if a newer version exists on the registry. This would change the lockfile.
**Why it happens:** npm resolves `^2` to latest compatible.
**How to avoid:** Pin to the known-working version: `npm install -D msw@2.12.10`. This preserves the exact version already in the lockfile.
**Alternative:** Use `npm install -D msw` and accept whatever version npm resolves — the `^2` range is fine since MSW 2.x is stable. Check that MSW 2.x API compatibility is maintained.
**Recommendation:** `npm install -D msw@2.12.10` to exactly match the lockfile, avoid any surprise version bumps.

### Pitfall 2: Lint Script Change Breaks Local Workflows

**What goes wrong:** Developer runs `npm run lint` locally and gets failures on pre-existing warnings they introduced.
**Why it happens:** The `--max-warnings 0` flag promotes warnings to CI failures.
**How to avoid:** Since the current codebase has zero warnings (verified locally), this is not an issue for the starting state. Developers must not introduce new ESLint warnings — this is the intended behavior.
**Warning signs:** `npm run lint` exits non-zero locally after Phase 19. This is correct behavior, not a bug.

### Pitfall 3: Schemas Barrel Deletion Missed Callers

**What goes wrong:** Deleting `src/lib/schemas/index.ts` breaks a file that imports from `@/lib/schemas`.
**Why it happens:** grep search missed a file.
**How to avoid:** Run `npx tsc --noEmit` after deletion. TypeScript will report any files that fail to resolve `@/lib/schemas` or `@/lib/schemas/index`.
**Verification command:** `npx tsc --noEmit && echo "CLEAN"` — must output CLEAN.

### Pitfall 4: CI Workflow Needs No Changes

**What goes wrong:** Planner might think `ci.yml` needs `--max-warnings 0` added to the lint step.
**Why it happens:** The audit says "CI lint job runs bare eslint without --max-warnings 0".
**Reality:** CI runs `npm run lint`. If `package.json` lint script includes `--max-warnings 0`, CI automatically gets the flag. No `ci.yml` change needed.

## Code Examples

### Fix 1: Promote MSW to direct devDependency
```bash
# Run from project root
npm install -D msw@2.12.10
```
Result in package.json devDependencies:
```json
"msw": "^2.12.10"
```

### Fix 2: Update lint script in package.json
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint --max-warnings 0",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

### Fix 3: Delete orphaned barrel file
```bash
# Delete the file
rm src/lib/schemas/index.ts

# Verify no TypeScript errors
npx tsc --noEmit
```

### Fix 4: useEffect — no action required
`listing-reviews.tsx` line 3 currently reads:
```typescript
import { useState } from "react";
```
No `useEffect` present. This item was resolved in Phase 14.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Transitive MSW via shadcn | Direct devDependency | Phase 19 | Lockfile regeneration no longer drops MSW silently |
| `"lint": "eslint"` | `"lint": "eslint --max-warnings 0"` | Phase 19 | Warning regressions now fail CI |
| Barrel `schemas/index.ts` | Deleted — sub-files only | Phase 19 | Dead file removed, import graph cleaner |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-03 | MSW devDep in package.json | smoke | `node -e "const p=require('./package.json');process.exit(p.devDependencies.msw?0:1)"` | ✅ (verify command) |
| E2E-06 | E2E passes in CI with direct MSW dep | e2e | `npx playwright test` | ✅ |
| CICD-01 | lint exits non-zero on warnings | smoke | `npm run lint` | ✅ |
| SIMP-01 | schemas/index.ts deleted, tsc clean | unit | `npx tsc --noEmit` | ✅ |
| SIMP-02 | No unused imports, tsc + vitest clean | unit | `npm test && npx tsc --noEmit` | ✅ |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm test && npx tsc --noEmit`
- **Phase gate:** `npm run lint && npm test && npx tsc --noEmit` all green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files needed.

## Open Questions

1. **MSW version pinning strategy**
   - What we know: MSW 2.12.10 is in the lockfile, MSW 2.x has been stable
   - What's unclear: Whether `npm install -D msw@2.12.10` or `npm install -D msw` (latest 2.x) is preferred
   - Recommendation: Pin to 2.12.10 to avoid any unintended upgrades during this hardening phase

2. **useEffect audit item**
   - What we know: The audit says `listing-reviews.tsx` has an unused `useEffect` import, but inspection shows no such import exists
   - What's unclear: Whether the audit was based on a stale file snapshot or the fix happened during Phase 14 execution
   - Recommendation: Document as pre-resolved in the plan. No action required. The plan should include a verification step confirming the absence.

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `package.json` — confirmed `msw` absent from devDependencies
- Direct file inspection: `package-lock.json` — confirmed `msw@2.12.10` present with `dev: true` via transitive dep
- Direct file inspection: `src/lib/schemas/index.ts` — confirmed file exists, zero callers via exhaustive grep
- Direct file inspection: `src/components/marketplace/listing-reviews.tsx` — confirmed no `useEffect` import
- Direct file inspection: `.github/workflows/ci.yml` — confirmed `npm run lint` without `--max-warnings 0`
- Direct execution: `npm run lint -- --max-warnings 0` exits code 0 — zero current warnings
- Direct execution: `npm test` — 222 tests pass in 22 files

### Secondary (MEDIUM confidence)
- `.planning/v1.1-MILESTONE-AUDIT.md` — source of all 4 tech debt items being addressed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all changes are to files we directly inspected
- Architecture: HIGH — all four changes are mechanical; no design decisions required
- Pitfalls: HIGH — each pitfall is grounded in the specific current state of the codebase

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable — no fast-moving dependencies)

---

## Pre-flight Summary for Planner

The planner should produce exactly **one plan (19-01-PLAN.md)** covering all four items. The tasks in order of priority:

1. **Task 1 (HIGH):** `npm install -D msw@2.12.10` — closes INT-MSW-DEP
2. **Task 2 (MEDIUM):** Update `package.json` lint script to `"eslint --max-warnings 0"` — closes INT-LINT-GATE
3. **Task 3 (LOW):** Delete `src/lib/schemas/index.ts` — closes SIMP-02 orphaned barrel
4. **Task 4 (ALREADY DONE):** Confirm `listing-reviews.tsx` has no `useEffect` — document as pre-resolved

After all tasks: `npx tsc --noEmit && npm test` must both pass clean.
