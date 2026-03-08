---
status: diagnosed
phase: 11-zod-runtime-validation
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md]
started: 2026-03-08T12:00:00Z
updated: 2026-03-08T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Homepage loads with ranked models
expected: Navigate to the homepage. The top-ranked models section displays model cards with names, providers, ranks, and market cap estimates. No blank sections or "no results" where data was previously visible.
result: pass

### 2. Leaderboard page loads all tabs
expected: Navigate to /leaderboards. The main leaderboard table shows ranked models with scores. Speed and Value tabs also load with data. Category sub-pages (e.g., /leaderboards/llm) render filtered results.
result: issue
reported: "all models tab shows nothing but other do"
severity: major

### 3. Model detail page loads with all sections
expected: Navigate to any model detail page (e.g., /models/gpt-4). Page shows model info, benchmark scores, pricing, ELO ratings, and rankings. All sections render data — no missing panels or empty sections that previously had content.
result: issue
reported: "404 showing up"
severity: blocker

### 4. Marketplace listing page loads
expected: Navigate to /marketplace and click into any listing. The listing detail page shows title, description, seller info, pricing, and reviews. The /marketplace browse page shows listing cards with correct metadata.
result: pass

### 5. Comments section loads and submits
expected: On a model detail page, the comments section loads existing comments with author info. If logged in, submitting a new comment works and appears in the list.
result: issue
reported: "fail"
severity: major

### 6. Orders page loads for authenticated user
expected: When logged in, navigate to /orders. The orders list shows your orders with status, listing info, and dates. Clicking an order shows the detail view with messages.
result: issue
reported: "now nothing is loading"
severity: blocker

### 7. Admin analytics page loads
expected: When logged in as admin, navigate to /admin/analytics. Charts and data tables render with model statistics. No blank charts or missing data sections.
result: issue
reported: "error runtime"
severity: blocker

### 8. TypeScript and test suite pass
expected: Run `npx tsc --noEmit` — should complete with zero errors. Run `npx vitest run` — all 193+ tests should pass with no failures.
result: pass

## Summary

total: 8
passed: 3
issues: 5
pending: 0
skipped: 0

## Gaps

- truth: "Leaderboard All models tab shows ranked models with scores"
  status: failed
  reason: "User reported: all models tab shows nothing but other do"
  severity: major
  test: 2
  root_cause: "Migration 014_multi_lens_scoring.sql was never applied to the production Supabase database. Seven columns are missing (capability_score, capability_rank, usage_score, usage_rank, expert_score, expert_rank, balanced_rank). The explorer query explicitly selects these columns, causing PostgreSQL error 42703. parseQueryResult silently returns []."
  artifacts:
    - path: "supabase/migrations/014_multi_lens_scoring.sql"
      issue: "Migration never applied to production DB"
    - path: "src/app/(rankings)/leaderboards/page.tsx"
      issue: "Line 47 explorer query selects non-existent columns"
    - path: "src/lib/schemas/parse.ts"
      issue: "Lines 28-30 silently return [] on DB error"
  missing:
    - "Apply migration 014_multi_lens_scoring.sql to production Supabase"
    - "Run compute-scores pipeline to populate the new columns"
  debug_session: ".planning/debug/uat-11-test2-leaderboard.md"

- truth: "Model detail page loads with all sections"
  status: failed
  reason: "User reported: 404 showing up"
  severity: blocker
  test: 3
  root_cause: "Postgres numeric and bigint columns are returned as strings by PostgREST/Supabase, but all Zod schemas define these fields as z.number() which rejects string values. parseQueryResultSingle() validation fails silently (returns null), and the page calls notFound() producing the 404."
  artifacts:
    - path: "src/lib/schemas/models.ts"
      issue: "All z.number() fields for numeric/bigint columns need z.coerce.number()"
    - path: "src/app/(catalog)/models/[slug]/page.tsx"
      issue: "Line 115 parseQueryResultSingle returns null, triggering notFound() on line 118"
    - path: "src/lib/schemas/parse.ts"
      issue: "Silent failure returns null on validation failure"
  missing:
    - "Replace z.number() with z.coerce.number() for all fields backed by Postgres numeric or bigint columns across all schema files"
  debug_session: ".planning/debug/uat-11-test3-model-detail.md"

- truth: "Comments section loads existing comments on model detail page"
  status: failed
  reason: "User reported: fail"
  severity: major
  test: 5
  root_cause: "Blocked by Test 3 — model detail page returns 404 due to z.number() vs string mismatch, so comments section never renders."
  artifacts:
    - path: "src/lib/schemas/models.ts"
      issue: "Same root cause as Test 3"
  missing:
    - "Fix Test 3 root cause (z.coerce.number) — comments should work once model page loads"
  debug_session: ".planning/debug/uat-11-test3-model-detail.md"

- truth: "Orders page loads for authenticated user"
  status: failed
  reason: "User reported: now nothing is loading"
  severity: blocker
  test: 6
  root_cause: "Client component orders-content.tsx queries Supabase directly using relationship alias joins (seller:seller_id(...)) that require a FK from marketplace_orders.seller_id to profiles.id. The FK does not exist, so the query fails and parseQueryResult silently returns []. Secondary bug: MarketplaceOrderSchema.buyer_id is z.string() (non-nullable) but the DB column allows null for guest orders."
  artifacts:
    - path: "src/app/(auth)/orders/orders-content.tsx"
      issue: "Lines 44-57 direct Supabase query with failing FK alias joins"
    - path: "src/app/(auth)/orders/[id]/order-detail-content.tsx"
      issue: "Same pattern with buyer + seller alias joins"
    - path: "src/lib/schemas/marketplace.ts"
      issue: "Line 59 buyer_id is non-nullable but DB allows null"
    - path: "src/app/api/marketplace/orders/route.ts"
      issue: "Correctly avoids the join — not used by client component"
  missing:
    - "Make client components use the API route (which correctly handles two-query enrichment) or refactor client queries to avoid FK alias joins"
    - "Fix buyer_id to z.string().nullable() in Zod schema"
  debug_session: ".planning/debug/uat-11-test6-orders.md"

- truth: "Admin analytics page loads with charts and data"
  status: failed
  reason: "User reported: error runtime"
  severity: blocker
  test: 7
  root_cause: "Inline ModelCatSchema defines is_open_weights as z.boolean() (non-nullable), but the DB column (boolean DEFAULT false) has no NOT NULL constraint. When any model row has is_open_weights=null, the entire z.array().safeParse() fails and parseQueryResult returns []. Secondary: no try-catch around async fetchAnalytics() causes unhandled promise rejection."
  artifacts:
    - path: "src/app/(admin)/admin/analytics/page.tsx"
      issue: "Line 60 inline ModelCatSchema has non-nullable is_open_weights"
    - path: "src/lib/schemas/analytics.ts"
      issue: "Line 11 shared ModelCatSchema same issue"
    - path: "src/lib/schemas/models.ts"
      issue: "Line 32 ModelBaseSchema also has non-nullable is_open_weights"
  missing:
    - "Change z.boolean() to z.boolean().nullable() for is_open_weights in all schemas"
    - "Add try-catch around async fetchAnalytics call"
    - "Audit ModelBaseSchema for other nullable mismatches"
  debug_session: ".planning/debug/uat-11-test7-admin-analytics.md"
