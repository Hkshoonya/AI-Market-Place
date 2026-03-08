---
status: diagnosed
trigger: "UAT test 7: Admin analytics page shows 'error runtime'"
created: 2026-03-08T14:00:00Z
updated: 2026-03-08T14:30:00Z
---

## Current Focus

hypothesis: Two root causes combine to break the admin analytics page -- (1) overly strict Zod schema causes silent data loss and (2) missing error handling lets any unexpected throw crash the page.
test: Code analysis of data flow and error paths
expecting: Identify exact Zod mismatch and missing guards
next_action: n/a -- diagnosis complete

## Symptoms

expected: /admin/analytics renders charts and data tables with model statistics (category breakdown, provider breakdown, open vs closed, top downloaded, top rated)
actual: User reports "error runtime" -- page fails to render correctly
errors: Likely a mix of (a) silent Zod validation failures logged to console/Sentry and (b) unhandled promise rejection if any part of fetchAnalytics throws
reproduction: Navigate to /admin/analytics as an admin user
started: After phase 11 (zod-runtime-validation) migration

## Eliminated

- hypothesis: "parseQueryResult itself throws an error"
  evidence: parseQueryResult uses safeParse internally and always returns [] on failure. The reportSchemaError function wraps Sentry calls in try-catch with console.error fallback. Confirmed by reading src/lib/schemas/parse.ts lines 23-40 and 78-100.
  timestamp: 2026-03-08T14:05:00Z

- hypothesis: "Zod v4 API breaking change causes crash"
  evidence: Verified that z.object(), z.array(), z.boolean(), .safeParse(), ZodError.issues, issue.code/path/message all work correctly in Zod v4.3.6. npx tsc --noEmit passes clean.
  timestamp: 2026-03-08T14:10:00Z

- hypothesis: "@sentry/nextjs import fails in client component"
  evidence: Sentry v10.42.0 is configured with both server and client instrumentation (src/instrumentation-client.ts, src/instrumentation.ts). Client-side Sentry is initialized. The import in parse.ts is wrapped in try-catch fallback. Other client components using parseQueryResult (orders-content.tsx, etc.) have the same import chain.
  timestamp: 2026-03-08T14:12:00Z

- hypothesis: "Recharts crashes on empty/zero data during render"
  evidence: PieChart with two zero values, BarChart with empty data arrays -- Recharts typically renders empty/nothing gracefully. Math.max(200, 0) returns 200 for height. No division-by-zero in the component code. While this is a possible Recharts edge case, it would not produce a "runtime error" -- at most an empty chart.
  timestamp: 2026-03-08T14:15:00Z

## Evidence

- timestamp: 2026-03-08T14:02:00Z
  checked: Database schema for is_open_weights column
  found: Column defined as `is_open_weights boolean DEFAULT false` with NO NOT NULL constraint in supabase/migrations/001_initial_schema.sql line 59. This means NULL values are permitted in the database.
  implication: Any model row could have is_open_weights = null.

- timestamp: 2026-03-08T14:03:00Z
  checked: Inline Zod schema in analytics page (line 60)
  found: ModelCatSchema uses `is_open_weights: z.boolean()` (non-nullable). This does NOT accept null values.
  implication: If any model has is_open_weights=null, the entire z.array(ModelCatSchema).safeParse() fails and parseQueryResult returns [].

- timestamp: 2026-03-08T14:04:00Z
  checked: Shared analytics schema at src/lib/schemas/analytics.ts line 11
  found: Also uses `is_open_weights: z.boolean()` (non-nullable). The page defines its own inline schemas rather than importing these, but BOTH have the same strictness issue.
  implication: Both the shared and inline versions have the same bug. The shared schema file was likely derived from the inline one.

- timestamp: 2026-03-08T14:05:00Z
  checked: Other schemas handling is_open_weights across the codebase
  found: Inconsistent treatment:
    - ModelBaseSchema (models.ts line 32): z.boolean() -- non-nullable
    - ExplorerModelSchema (models.ts line 172): z.boolean().nullable() -- nullable
    - RankedModelSchema (rankings.ts line 18): z.boolean().nullable() -- nullable
    - CategoryModelSchema (rankings.ts line 89): z.boolean().nullable() -- nullable
  implication: The schema authors were inconsistent. Some schemas account for null, others don't. The analytics page uses the strict version.

- timestamp: 2026-03-08T14:07:00Z
  checked: Verified Zod behavior with null value
  found: Ran test confirming z.boolean() rejects null with "Invalid input: expected boolean, received null". The entire array validation fails, causing parseQueryResult to return [].
  implication: A single null is_open_weights in ANY model row silently empties the entire dataset for the page.

- timestamp: 2026-03-08T14:08:00Z
  checked: Error handling in fetchAnalytics useEffect (analytics page lines 56-120)
  found: NO try-catch wrapping the async function. NO .catch() on the fetchAnalytics() call. If any unexpected error occurs, it becomes an unhandled promise rejection. setLoading(false) would never be reached, leaving the page stuck on the loading skeleton.
  implication: The page has zero resilience to unexpected runtime errors.

- timestamp: 2026-03-08T14:09:00Z
  checked: TypeScript interface for Model (database.ts line 50)
  found: `is_open_weights: boolean` (non-nullable). The TypeScript type ALSO doesn't account for null, matching the database DEFAULT but not the actual column constraint.
  implication: The type system and Zod schemas both assume is_open_weights is never null, but the database allows it. This is a systemic assumption that may be correct for all existing data, OR there could be edge case rows with null.

- timestamp: 2026-03-08T14:12:00Z
  checked: The admin overview page (/admin) at src/app/(admin)/admin/page.tsx
  found: This page does NOT use parseQueryResult -- it still uses the old pattern with raw Supabase data and ?? [] fallbacks. It was NOT migrated in phase 11.
  implication: The overview page would work fine, while the analytics page (which was migrated) could silently lose data. This confirms the phase 11 migration is the differentiator.

- timestamp: 2026-03-08T14:14:00Z
  checked: How the page renders with empty data after Zod failure
  found: parseQueryResult returns [] -> models is [] -> categoryBreakdown [], providerBreakdown [], openVsClosed {open: 0, closed: 0} -> page renders with completely empty/zero charts. topDownloaded and topRated ALSO become [] if their schemas are too strict or if there's a null quality_score/hf_downloads that doesn't match.
  implication: The page "works" (doesn't crash) but shows no data. The user may interpret empty charts + zero counts as a "runtime error", especially if the page previously showed data before the migration.

- timestamp: 2026-03-08T14:18:00Z
  checked: The other UAT failures (tests 2, 3, 5, 6) for common pattern
  found: Test 6 (orders page) also uses parseQueryResult in a client component (orders-content.tsx). Test 2 (leaderboard) and test 3 (model detail) use parseQueryResult in server components. The common theme across all failures is the migration to parseQueryResult with schemas that may be too strict.
  implication: This is likely a systemic issue where schemas don't account for nullable DB columns, causing silent data loss across multiple pages.

## Resolution

root_cause: |
  Two issues combine to cause the admin analytics page failure:

  **Primary: Overly strict Zod schema for `is_open_weights`.**
  The inline `ModelCatSchema` (line 60) defines `is_open_weights: z.boolean()`, but the database column `is_open_weights boolean DEFAULT false` has no NOT NULL constraint. If ANY model row has `is_open_weights = null`, the entire `z.array(ModelCatSchema).safeParse()` fails, and `parseQueryResult` returns an empty array `[]`. This silently wipes ALL model data from the analytics page, causing every chart to show zero/empty data. The same issue exists in the shared `src/lib/schemas/analytics.ts` file.

  **Secondary: No error handling in useEffect async function.**
  The `fetchAnalytics()` call (line 119) has no `try-catch` or `.catch()`. If any unexpected error occurs during the async flow, the page gets stuck on the loading skeleton forever (unhandled promise rejection). Even the silent Zod validation failure triggers a `Sentry.captureException` call inside `reportSchemaError` -- if that throws for any reason (despite the try-catch), the unhandled error propagates up.

  **Contributing factor: Schema inconsistency across codebase.**
  Some schemas define `is_open_weights: z.boolean().nullable()` (rankings.ts, ExplorerModelSchema) while others use `z.boolean()` (ModelBaseSchema, analytics schemas). The database constraint allows null, so all schemas should use `.nullable()`.

fix: |
  1. Change inline ModelCatSchema `is_open_weights` from `z.boolean()` to `z.boolean().nullable()` (line 60 of analytics page)
  2. Update the shared `ModelCatSchema` in src/lib/schemas/analytics.ts similarly
  3. Add try-catch around fetchAnalytics() in the useEffect, with a fallback that sets loading=false and shows an error state
  4. Audit other is_open_weights Zod definitions for the same nullable mismatch (ModelBaseSchema in models.ts line 32)
  5. Update line 98 `models.filter((m) => m.is_open_weights)` to handle null safely (already safe since `null` is falsy, but type annotation should be correct)

verification: n/a -- research only, no fix applied
files_changed: []
