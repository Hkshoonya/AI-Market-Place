# Deferred Items — Phase 22 Railway Deployment

## Pre-existing Lint Errors (Out of Scope)

These errors existed before Plan 22-01 and are not caused by this plan's changes.

### server/custom-server.js — require() imports (5 errors)
Lines 12-16: `@typescript-eslint/no-require-imports` — custom-server.js is a CommonJS file and must use require(). ESLint config needs `env: { node: true }` override or file-level disable comment.

### src/app/api/admin/sync/route.test.ts — prefer-const (2 errors), unused var (1 warning)
Lines 180, 221: `capturedEqCalls` declared with `let` but never reassigned.
Line 182: `queryChain` assigned but never used.

### src/app/(admin)/admin/data-sources/page.tsx — unused var (1 warning)
Line 37: `formatRelativeDate` imported but not used.

### src/lib/data-sources/orchestrator.test.ts — unused vars (2 warnings)
Lines 70, 74: `mockUpsertFn`, `mockSelectFn` assigned but never used.

**Note:** These should be fixed in a dedicated lint-cleanup plan.
