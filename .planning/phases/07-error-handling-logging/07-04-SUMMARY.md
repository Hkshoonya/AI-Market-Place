---
phase: 07-error-handling-logging
plan: 04
subsystem: api-error-handling
tags: [error-handling, logging, marketplace, webhooks, api-routes]
dependency_graph:
  requires: [07-01]
  provides: [ERR-02, LOG-02]
  affects: [marketplace-api, seller-api, webhook-api]
tech_stack:
  added: []
  patterns: [handleApiError-catch-wrapper, createTaggedLogger-webhook, void-systemLog-fire-and-forget]
key_files:
  created: []
  modified:
    - src/app/api/marketplace/auctions/[id]/accept/route.ts
    - src/app/api/marketplace/auctions/[id]/bid/route.ts
    - src/app/api/marketplace/auctions/[id]/route.ts
    - src/app/api/marketplace/auctions/route.ts
    - src/app/api/marketplace/listings/[slug]/manifest/route.ts
    - src/app/api/marketplace/listings/[slug]/pricing/route.ts
    - src/app/api/marketplace/listings/[slug]/report/route.ts
    - src/app/api/marketplace/listings/[slug]/reviews/route.ts
    - src/app/api/marketplace/listings/[slug]/route.ts
    - src/app/api/marketplace/listings/bot/route.ts
    - src/app/api/marketplace/listings/route.ts
    - src/app/api/marketplace/orders/[id]/messages/route.ts
    - src/app/api/marketplace/orders/[id]/route.ts
    - src/app/api/marketplace/orders/route.ts
    - src/app/api/marketplace/purchase/route.ts
    - src/app/api/marketplace/seller/stats/route.ts
    - src/app/api/marketplace/seller/verify/route.ts
    - src/app/api/marketplace/wallet/route.ts
    - src/app/api/seller/earnings/route.ts
    - src/app/api/seller/withdraw/route.ts
    - src/app/api/webhooks/chain-deposits/route.ts
decisions:
  - "handleApiError try/catch wraps full handler body — rate limit 429 and auth 401 responses remain outside to avoid catch interference"
  - "webhook/chain-deposits uses createTaggedLogger (not inline systemLog) — pre-binds source string for 7 call sites in nested functions"
  - "void prefix on all log.error/warn calls in non-critical paths — fire-and-forget, logging failure must not affect HTTP response"
  - "wallet route replaced custom inline error formatting with handleApiError — consistent { error: string } shape"
  - "orders/[id] escrow/delivery errors log with systemLog then continue — partial success (status updated) should still return 200"
metrics:
  duration: 25
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 21
---

# Phase 7 Plan 4: Marketplace, Seller, and Webhook API Route Migration Summary

Migrated all 21 marketplace, seller, and webhook API routes to use `handleApiError` for error responses and structured logging via `systemLog`/`createTaggedLogger`. Zero `console.error`/`console.warn` now remains across all 68 API route files.

## What Was Built

All marketplace and seller API routes now use a consistent error handling pattern: each route handler body is wrapped in `try/catch` that delegates to `handleApiError(err, "api/source/path")` for unexpected errors. Inline `console.error`/`console.warn` calls (8 total across 5 files) were replaced with `void systemLog.error/warn(...)` structured calls. The payment webhook route (`webhooks/chain-deposits`) uses `createTaggedLogger("webhook/chain-deposits")` to pre-bind the source string for its 7 log call sites spread across nested helper functions.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Migrate 18 marketplace routes to handleApiError + structured logging | d7d9345 | 18 files |
| 2 | Migrate seller and webhook routes + final zero-console sweep | 27dce01 | 3 files |

## Verification Results

- `npx tsc --noEmit` — passes clean
- `grep -r "console\.error|console\.warn" src/app/api/` — 0 matches
- `grep -r "handleApiError" src/app/api/ | wc -l` — 141 usages across all route categories

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Additional Notes

- `wallet/route.ts` already had try/catch blocks but used custom inline error formatting (`err instanceof Error ? err.message : "..."`) — replaced with `handleApiError` for consistency (Rule 2: missing correctness requirement).
- `seller/earnings/route.ts` similarly had custom catch block replaced with `handleApiError`.
- The `orders/[id]/route.ts` escrow/delivery errors are caught in inner try/catch (not surfaced to client) because partial success is valid — order status was updated successfully. These are logged via `systemLog.error` then execution continues.

## Self-Check: PASSED

- src/app/api/marketplace/orders/[id]/route.ts — FOUND
- src/app/api/webhooks/chain-deposits/route.ts — FOUND
- Task 1 commit d7d9345 — FOUND
- Task 2 commit 27dce01 — FOUND
