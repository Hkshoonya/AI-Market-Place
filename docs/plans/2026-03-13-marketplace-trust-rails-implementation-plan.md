# Marketplace Trust Rails Implementation Plan

## Goal

Implement deterministic listing policy scans and first-pass autonomous purchase guardrails with forward-only schema, regression tests, and enough admin visibility to operate the new controls.

## Task 1: Add failing tests for the policy engine and purchase guardrails

### Files

- Create: `src/lib/marketplace/policy.test.ts`
- Modify: `src/lib/marketplace/purchase-handlers.test.ts`
- Modify: `src/app/api/marketplace/listings/route.test.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.test.ts`
- Modify: `src/app/api/marketplace/listings/[slug]/route.test.ts`

### Coverage

- obvious illegal-goods content becomes `block`
- suspicious but ambiguous content becomes `review`
- normal listings remain `allow`
- create routes force `draft` when policy is `review` or `block`
- update routes pause active listings when policy becomes `review` or `block`
- API-key purchase is rejected above per-order cap
- API-key purchase is rejected when daily cap is exceeded
- API-key purchase is rejected for disallowed listing types
- API-key purchase is rejected when seller verification is required but missing
- session-based purchases bypass autonomous purchase caps

## Task 2: Add forward-only schema

### Files

- Create: `supabase/migrations/040_marketplace_trust_rails.sql`
- Modify: `src/types/database.ts`

### Schema

Add:

- `listing_policy_reviews`
- `autonomous_commerce_policies`

Include:

- indexes
- RLS
- service-role management policies
- admin read access

Also add deferred completion updates for:

- `illegal-goods-policy-engine`
- `autonomous-commerce-guardrails`

These can live in the same migration.

## Task 3: Implement the shared marketplace policy engine

### Files

- Create: `src/lib/marketplace/policy.ts`
- Test: `src/lib/marketplace/policy.test.ts`

### Behavior

Implement:

- deterministic pattern-based classification
- safe manifest/tool-name inspection
- normalized output payload:
  - `decision`
  - `label`
  - `confidence`
  - `reasons`
  - `matchedSignals`

Keep it framework-agnostic so routes and future agents can reuse it.

## Task 4: Integrate listing scans

### Files

- Modify: `src/app/api/marketplace/listings/route.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.ts`
- Modify: `src/app/api/marketplace/listings/[slug]/route.ts`

### Behavior

- evaluate before insert/update
- write a `listing_policy_reviews` row for `review` or `block`
- force safe fallback statuses:
  - create -> `draft`
  - active update -> `paused`

Admin-driven edits should not be auto-blocked in this slice, but they should still be able to trigger or resolve review records later.

## Task 5: Integrate autonomous purchase guardrails

### Files

- Modify: `src/lib/marketplace/purchase-handlers.ts`
- Modify: `src/app/api/marketplace/purchase/route.ts`
- Modify: `src/lib/auth/resolve-user.ts` only if extra auth detail is required

### Behavior

For API-key purchases only:

- load or synthesize autonomous policy defaults
- enforce max order amount
- enforce daily spend limit
- enforce allowed listing types
- require verified seller when configured
- reject flagged listings with unresolved review/block state when configured

Keep existing human session behavior unchanged.

## Task 6: Add admin visibility

### Files

- Modify: `src/app/api/admin/listings/route.ts`
- Create or modify tests as needed

### Behavior

Return lightweight policy status fields for listings:

- latest decision
- latest label
- latest review status
- review created_at

That is enough for operators before a fuller dedicated policy dashboard exists.

## Task 7: Verify and ship

### Commands

- `npm test -- src/lib/marketplace/policy.test.ts src/lib/marketplace/purchase-handlers.test.ts src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts`
- `npm run build`

### Live follow-up

- apply migration directly to Supabase
- verify deferred items are marked `done`
- verify `/api/health` remains healthy
- verify a safe listing can still publish normally
- verify a blocked listing is saved but not public
- verify API-key purchase caps reject as expected
