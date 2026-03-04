---
phase: 03-api-route-decomposition
plan: "02"
subsystem: marketplace
tags: [decomposition, marketplace, purchase, handlers, escrow, delivery]
dependency_graph:
  requires: []
  provides: [purchase-handlers.ts with handleGuestCheckout + handleAuthenticatedCheckout]
  affects: [src/app/api/marketplace/purchase/route.ts]
tech_stack:
  added: []
  patterns: [parameter-injection, handler-delegation, thin-http-wrapper]
key_files:
  created:
    - src/lib/marketplace/purchase-handlers.ts
  modified:
    - src/app/api/marketplace/purchase/route.ts
decisions:
  - "PurchaseResult includes httpStatus field so route can delegate status code selection to handlers"
  - "errorDetails field on PurchaseResult carries structured error data (e.g. required/balance for 402)"
  - "autoCompleteOrder and createOrderRecord are private helpers shared by both exported handlers"
  - "Guest checkout uses order.id as deliverUserId (matching original route behavior)"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 2
---

# Phase 3 Plan 02: Purchase Route Decomposition Summary

**One-liner:** Purchase route decomposed into handleGuestCheckout + handleAuthenticatedCheckout handlers in purchase-handlers.ts, with parameter-injected Supabase client and no Next.js server dependency.

## What Was Built

Extracted 327-line purchase route into two testable handler functions in a dedicated file `src/lib/marketplace/purchase-handlers.ts`, following the same parameter-injection pattern as `escrow.ts`. The route file is now a 119-line thin HTTP wrapper.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create purchase-handlers.ts | 482803b | src/lib/marketplace/purchase-handlers.ts |
| 2 | Rewrite purchase route as thin wrapper | bc9eb94 | src/app/api/marketplace/purchase/route.ts |

## Key Changes

**src/lib/marketplace/purchase-handlers.ts** (new, 397 lines):
- `PurchaseResult` interface with `httpStatus` field for clean route delegation
- `ListingData` interface (plain, no Supabase generated types)
- `handleGuestCheckout(sb, listing, guestEmail, guestName)` — validates free-only, dedup check, creates order, delivers
- `handleAuthenticatedCheckout(sb, listing, userId, authMethod)` — validates ownership, checks balance, creates escrow, delivers
- Private `createOrderRecord` helper shared by both handlers
- Private `autoCompleteOrder` helper handles deliver -> complete escrow -> update order -> increment purchases
- No NextRequest/NextResponse imports; Supabase client injected as parameter

**src/app/api/marketplace/purchase/route.ts** (119 lines, was 327):
- Keeps: rate limit, Zod schema, body parse, auth resolution, listing fetch
- Delegates to `handleGuestCheckout` or `handleAuthenticatedCheckout` based on `isGuest`
- `toResponse()` helper converts `PurchaseResult` to `NextResponse`
- No wallet/escrow/delivery imports

## Verification Results

1. `npx tsc --noEmit` — passes with zero errors
2. Route file is 119 lines (under 120 limit)
3. `grep "NextRequest\|NextResponse" src/lib/marketplace/purchase-handlers.ts` — no matches
4. `grep "import.*escrow\|import.*delivery\|import.*wallet" src/app/api/marketplace/purchase/route.ts` — no matches
5. Both `handleGuestCheckout` and `handleAuthenticatedCheckout` exported from purchase-handlers.ts

## Decisions Made

- **httpStatus on PurchaseResult:** Route delegates HTTP status code selection to handlers, avoiding string pattern-matching on error messages
- **errorDetails field:** Structured data (required, balance) for 402 insufficient_balance errors passed separately from error string
- **Guest deliverUserId:** Uses `order.id` as the buyer ID for delivery (matches original route behavior on lines 234-235)
- **Private helpers not exported:** `createOrderRecord` and `autoCompleteOrder` are implementation details, not part of the public API

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] src/lib/marketplace/purchase-handlers.ts exists
- [x] src/app/api/marketplace/purchase/route.ts modified
- [x] Commit 482803b exists
- [x] Commit bc9eb94 exists
- [x] TypeScript clean

## Self-Check: PASSED
