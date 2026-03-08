---
status: diagnosed
trigger: "/leaderboards page 'All models' tab shows nothing while other tabs work"
created: 2026-03-08T00:00:00Z
updated: 2026-03-08T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Explorer query fails because migration 014_multi_lens_scoring.sql was never applied to production DB
test: Queried Supabase directly for each column from migration 014
expecting: All 7 columns should exist if migration was applied
next_action: Apply migration 014 to production DB, OR remove missing columns from explorer query

## Symptoms

expected: /leaderboards default "Explorer" tab (All Models) displays a data grid of ranked models
actual: The tab renders with zero rows -- table is empty
errors: PostgreSQL error 42703 "column models.capability_score does not exist" (silent -- caught by parseQueryResult returning [])
reproduction: Visit /leaderboards, default Explorer tab shows no models
started: After phase 11 (zod-runtime-validation) added parseQueryResult with Zod schemas that select these columns explicitly

## Eliminated

- hypothesis: Supabase returns NUMERIC columns as strings, causing z.number() validation to fail
  evidence: Direct Supabase query confirmed quality_score (NUMERIC(10,4)) returns as JavaScript number, not string. Zod validation passes for existing columns.
  timestamp: 2026-03-08T00:00:00Z

- hypothesis: category_rank column is missing from database
  evidence: Direct query confirmed category_rank EXISTS. It was likely added manually outside of migrations.
  timestamp: 2026-03-08T00:00:00Z

- hypothesis: ExplorerModelSchema has wrong field types causing Zod validation to reject valid rows
  evidence: When querying only existing columns, Zod validation succeeds. Schema types match actual DB return types.
  timestamp: 2026-03-08T00:00:00Z

## Evidence

- timestamp: 2026-03-08T00:00:00Z
  checked: Explorer query replicating exact select from leaderboards/page.tsx line 47
  found: PostgREST returns error 42703 "column models.capability_score does not exist"
  implication: The entire query fails at DB level; parseQueryResult returns [] due to response.error being set

- timestamp: 2026-03-08T00:00:00Z
  checked: Each column from migration 014_multi_lens_scoring.sql individually
  found: 7 columns MISSING from production DB -- capability_score, capability_rank, usage_score, usage_rank, expert_score, expert_rank, balanced_rank
  implication: Migration 014 was never applied to production Supabase

- timestamp: 2026-03-08T00:00:00Z
  checked: category_rank column existence
  found: category_rank EXISTS in production DB (was added outside of migration files)
  implication: Not the cause; only the 7 multi-lens columns are missing

- timestamp: 2026-03-08T00:00:00Z
  checked: SELECT * query (used by category pages and Top 20)
  found: Returns only existing columns. RankedModelSchema validates successfully because it does not reference missing columns.
  implication: Explains why Top 20 tab, category pages, Speed, and Value tabs all work fine

- timestamp: 2026-03-08T00:00:00Z
  checked: NUMERIC column return types from Supabase
  found: quality_score (NUMERIC(10,4)) returned as JavaScript number (not string). value_score, popularity_score also numbers.
  implication: Supabase JS client handles NUMERIC -> number coercion correctly; this is NOT a type mismatch issue

- timestamp: 2026-03-08T00:00:00Z
  checked: parseQueryResult behavior on DB error
  found: When response.error is set, function returns [] immediately (parse.ts line 28-30). No error is logged to console -- failure is silent.
  implication: The empty Explorer tab gives no visible error to the developer. Errors go to Sentry only if the Zod validation path is reached (it's not -- the DB error short-circuits first).

- timestamp: 2026-03-08T00:00:00Z
  checked: Why category pages work despite CategoryModelSchema having category_rank
  found: Category pages use SELECT * which only returns existing columns. category_rank EXISTS in the DB. CategoryModelSchema does NOT reference capability_score/usage_score/etc.
  implication: Category pages are unaffected because they never request non-existent columns

## Resolution

root_cause: |
  Migration `014_multi_lens_scoring.sql` was never applied to the production Supabase database.
  This migration adds 7 columns: capability_score, capability_rank, usage_score, usage_rank,
  expert_score, expert_rank, balanced_rank.

  The Explorer query on leaderboards/page.tsx (line 47) explicitly selects these columns.
  PostgreSQL returns error 42703 ("column models.capability_score does not exist").
  parseQueryResult (parse.ts line 28-30) catches the error and returns an empty array.
  The LeaderboardExplorer component receives 0 models and renders an empty table.

  Other tabs are unaffected because:
  - Speed/Value tabs query model_pricing table, not models
  - Top 20 tab uses SELECT * which only returns existing columns
  - Category pages use SELECT * and CategoryModelSchema doesn't reference missing columns
  - Benchmarks/Frontier/Timeline tabs fetch from separate API routes

fix: |
  TWO actions needed:

  1. Apply migration 014 to production:
     Run the SQL in supabase/migrations/014_multi_lens_scoring.sql against the production
     Supabase database (via SQL Editor in Supabase Dashboard or supabase db push).

  2. Run compute-scores pipeline after migration:
     The new columns will be NULL until the scoring pipeline runs. Trigger the
     /api/cron/compute-scores endpoint to populate capability_score, usage_score,
     expert_score, and their rank columns.

  OPTIONAL: Also add migration for category_rank column (currently exists in DB but
  has no migration file -- should be formalized).

verification: Not yet verified (diagnosis only mode)
files_changed: []
