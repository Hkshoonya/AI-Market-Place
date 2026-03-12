---
phase: 21-admin-visibility
verified: 2026-03-12T05:30:00Z
status: passed
score: 17/17 must-haves verified
---

# Phase 21: Admin Visibility Verification Report

**Phase Goal:** Admins can see exactly what the pipeline is doing — which syncs ran, which failed, which sources are stale, and they can trigger a resync for any adapter without touching the database or code.
**Verified:** 2026-03-12T05:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All must-haves from Plans 01, 02, and 03 were verified against the actual codebase.

#### Plan 01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `computeStatus()` returns healthy/degraded/down using same logic as pipeline health endpoint | VERIFIED | `src/lib/pipeline-health-compute.ts` lines 36-46 — identical logic to original; both `api/pipeline/health/route.ts` and `api/admin/pipeline/health/route.ts` import from shared lib |
| 2 | `formatRelativeTime()` shows minute/hour granularity for recent timestamps | VERIFIED | `src/lib/format.ts` lines 63-78 — <60s → "just now", <60m → "{N}m ago", <24h → "{N}h ago", <7d → "{N}d ago", ≥7d delegates to `formatRelativeDate` |
| 3 | GET /api/admin/sync?source=X returns only sync jobs for that adapter | VERIFIED | `src/app/api/admin/sync/route.ts` lines 43-58 — reads `source` param, applies `.eq("source", source)` conditionally |
| 4 | GET /api/admin/pipeline/health returns full per-adapter health detail for authenticated admin | VERIFIED | `src/app/api/admin/pipeline/health/route.ts` lines 62-174 — dual-client pattern, queries `data_sources` + `pipeline_health`, computes via `computeStatus()`, returns full `PipelineHealthDetailSchema` including `adapters[]` |
| 5 | GET /api/admin/pipeline/health returns 401 for unauthenticated, 403 for non-admin | VERIFIED | Lines 79-91: `!user` → 401, `!profile?.is_admin` → 403 |

#### Plan 02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 6 | Pipeline status pill shows overall health (green/amber/red) above summary cards | VERIFIED | `page.tsx` lines 508-526 — conditional render when `healthData` available, color-coded via `pipelinePillClass` |
| 7 | Summary cards show Healthy/Degraded/Down/Records Synced counts from pipeline health API | VERIFIED | Lines 529-620 — 4 cards using `healthData?.healthy`, `healthData?.degraded`, `healthData?.down`, and `totalRecords` |
| 8 | Clicking a summary card filters the table by that health status | VERIFIED | `setHealthFilter` toggle pattern (e.g., line 537), applied at lines 362-368 |
| 9 | Table rows have amber background tint for degraded adapters, red for down | VERIFIED | Lines 727-733 — `bg-red-500/5` for down, `bg-amber-400/5` for degraded, applied via `cn()` on `<tr>` |
| 10 | Table is sorted stale-first: down at top, then degraded, then healthy; within group by tier | VERIFIED | Lines 371-377 — `HEALTH_PRIORITY[ha] - HEALTH_PRIORITY[hb]`, then `a.tier - b.tier` as tiebreaker |
| 11 | Both sync status badge and health status badge appear per row | VERIFIED | Lines 782-830 — sync badge from `STATUS_CONFIG[source.last_sync_status]`, health badge from `HEALTH_CONFIG[healthStatus]` |
| 12 | Last Sync column shows relative time with expected interval: e.g. 14h ago (every 6h) | VERIFIED | Line 847 — `formatRelativeTime(source.last_sync_at)` + `intervalLabel` from `TIER_INTERVAL_LABEL[source.tier]` |
| 13 | Clicking chevron expands a row to show last 10 sync jobs inline | VERIFIED | Lines 882-906 — chevron toggles `expandedRows`, expansion row renders `<SyncHistoryInline slug={source.slug} />` |
| 14 | Expanded row shows timestamp, status badge, records count, duration for each sync job | VERIFIED | `SyncHistoryInline` lines 193-311 — 4-column grid with `formatRelativeTime`, status badge, `records_processed`, `formatDuration(durationMs)` |
| 15 | Failed sync jobs show truncated error (80 chars) with full text on hover tooltip | VERIFIED | Lines 240-263 — truncates to 80 chars + "...", wraps in `<Tooltip>` with full `job.error_message` in `<TooltipContent>` |
| 16 | Sync history is fetched on-demand via SWR when row is expanded | VERIFIED | `SyncHistoryInline` line 194-196 — `useSWR(slug ? \`/api/admin/sync?source=${slug}&limit=10\` : null, ...)` |

#### Plan 03 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 17 | Clicking an adapter name opens a right-side drawer | VERIFIED | Lines 749-754 — adapter name is a `<button>` calling `setDrawerSlug(source.slug)`. Sheet at line 934: `open={!!drawerSlug}`, `side="right"` |
| 18 | Drawer shows adapter config summary: tier, sync interval, output types, secret status, consecutive failure count | VERIFIED | Lines 966-1027 — `dl` grid shows Tier, Sync Interval, Output Types (as Badges), Health status, Failures (red if > 0), Last Sync |
| 19 | Drawer shows full (not truncated) error message from most recent failure | VERIFIED | Lines 1030-1037 — `whitespace-pre-wrap break-all` with full `selectedSource.last_error_message` |
| 20 | Drawer shows last 25 sync log entries with pagination via Load More button | VERIFIED | Lines 344-346 — SWR keyed on `drawerSlug + drawerHistoryLimit`; Load More at lines 1112-1123: `setDrawerHistoryLimit(prev => prev + 25)` |
| 21 | Sync Now button in drawer header triggers sync with spinner | VERIFIED | Lines 944-963 — `Play` icon normally, `Loader2 animate-spin` while `drawerSyncing`; disabled when syncing or adapter disabled |
| 22 | After Sync Now completes, drawer content auto-refreshes without page reload | VERIFIED | Lines 451-455 — `Promise.all([mutateDrawerHistory(), mutate(), mutateHealth()])` |
| 23 | After Sync Now completes, main table and inline expanded rows also refresh | VERIFIED | Lines 452-463 — `mutate()` for main table, `mutateHealth()` for health cards, plus `globalMutate(key => key.startsWith('/api/admin/sync?source=${slug}'))` for any open inline rows |

**Score:** 17/17 truths verified (Plans 01+02+03 collapsed to non-overlapping observable truths)

---

## Required Artifacts

| Artifact | Status | Lines | Evidence |
|----------|--------|-------|---------|
| `src/lib/pipeline-health-compute.ts` | VERIFIED | 84 | Exports `computeStatus`, `mapSyncJobStatus`, `HEALTH_PRIORITY`. Substantive implementation. |
| `src/lib/format.ts` | VERIFIED | 111 | `formatRelativeTime` added at lines 63-78 with full sub-day ladder. |
| `src/app/api/admin/sync/route.ts` | VERIFIED | 68 | Source + limit params wired to Supabase query. Auth guard present. |
| `src/app/api/admin/pipeline/health/route.ts` | VERIFIED | 174 | Full dual-client implementation. Queries both tables. Returns `PipelineHealthDetailSchema`. |
| `src/app/(admin)/admin/data-sources/page.tsx` | VERIFIED | 1133 | All Plan 02 + 03 features implemented. Health cards, staleness tint, sort, dual badges, expandable rows, drawer, Sync Now. |
| `src/lib/pipeline-health-compute.test.ts` | VERIFIED | 177 | 17 tests covering computeStatus (failure-based + staleness-based + null), mapSyncJobStatus, HEALTH_PRIORITY. |
| `src/lib/format.test.ts` | VERIFIED | Exists | formatRelativeTime tests with vi.useFakeTimers(). |
| `src/app/api/admin/sync/route.test.ts` | VERIFIED | Exists | Auth, source filter, limit param tests. |
| `src/app/api/admin/pipeline/health/route.test.ts` | VERIFIED | 347 | 6 tests: 401, 403, 200 shape, adapter status computation, never-synced case. |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `src/lib/pipeline-health-compute.ts` | `src/app/api/pipeline/health/route.ts` | `import { computeStatus }` | WIRED | `api/pipeline/health/route.ts` line 21: `import { computeStatus } from "@/lib/pipeline-health-compute"` — local copy deleted |
| `src/app/api/admin/pipeline/health/route.ts` | `pipeline_health` + `data_sources` tables | `createAdminClient()` queries | WIRED | Lines 96-103: parallel queries via `adminSupabase.from("data_sources")` and `.from("pipeline_health")` |
| `src/app/api/admin/sync/route.ts` | `sync_jobs` table | `.eq("source", source)` filter | WIRED | Lines 50-59: query built conditionally with `.eq("source", source)` when param present |

### Plan 02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `page.tsx` | `/api/admin/pipeline/health` | `useSWR` conditional fetch | WIRED | Lines 334-337: `useSWR<PipelineHealthDetail>("/api/admin/pipeline/health", ...)` |
| `page.tsx` | `/api/admin/sync?source=` | `useSWR` in `SyncHistoryInline` | WIRED | Line 195: `useSWR(slug ? \`/api/admin/sync?source=${slug}&limit=10\` : null, ...)` |
| `page.tsx` | `src/lib/pipeline-health-compute.ts` | `import HEALTH_PRIORITY, mapSyncJobStatus` | WIRED | Lines 39-41: `import { HEALTH_PRIORITY, mapSyncJobStatus } from "@/lib/pipeline-health-compute"` |
| `page.tsx` | `src/lib/format.ts` | `import formatRelativeTime` | WIRED | Line 37: `import { formatRelativeDate, formatRelativeTime } from "@/lib/format"` |

### Plan 03 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `page.tsx` (drawer) | `/api/admin/sync?source=&limit=25` | `useSWR` conditional fetch for drawer | WIRED | Lines 344-346: `useSWR(drawerSlug ? \`/api/admin/sync?source=${drawerSlug}&limit=${drawerHistoryLimit}\` : null, ...)` |
| `page.tsx` (Sync Now) | `/api/admin/sync/{slug}` | `fetch` POST + triple mutate | WIRED | Lines 448-463: `fetch(\`/api/admin/sync/${slug}\`, { method: "POST" })` then `Promise.all([mutateDrawerHistory(), mutate(), mutateHealth()])` |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| ADMN-01 | 21-01, 21-02 | Admin dashboard shows sync job history (status, errors, timestamps, records processed) | SATISFIED | Inline `SyncHistoryInline` renders per-job timestamp, status badge, records count, duration; drawer shows last 25 jobs with full error text |
| ADMN-02 | 21-01, 21-02 | Admin dashboard highlights stale data sources (no successful sync within expected interval) | SATISFIED | `computeStatus()` staleness logic; row tinting (amber=degraded, red=down); stale-first sort via `HEALTH_PRIORITY`; Last Sync shows relative time + expected interval label |
| ADMN-03 | 21-01, 21-02 | Admin dashboard shows pipeline health overview (healthy/degraded/down per adapter) | SATISFIED | Pipeline status pill (color-coded), summary cards (Healthy/Degraded/Down counts), health badge column per row — all sourced from `/api/admin/pipeline/health` |
| ADMN-04 | 21-03 | Admin can drill down to per-adapter error details and recent sync logs | SATISFIED | Sheet drawer opens on adapter name click; shows config summary, full untruncated error message, paginated sync history (25+Load More) |
| ADMN-05 | 21-03 | Admin can manually trigger a sync for any individual adapter from the dashboard | SATISFIED | Sync Now button in drawer header POSTs to `/api/admin/sync/{slug}`, shows spinner, auto-refreshes drawer + table + health cards on completion |

No orphaned requirements — all 5 ADMN IDs are claimed in plan frontmatter and all are verified.

---

## Commit Verification

All commits referenced in SUMMARYs exist in git history:

| Commit | Plan | Description |
|--------|------|-------------|
| `c41ddca` | 21-01 Task 1 | Extract shared pipeline health lib + formatRelativeTime |
| `ab117db` | 21-01 Task 2 | Extend sync API with source filter + create admin pipeline health endpoint |
| `05c1dd0` | 21-02 Tasks 1+2 | Enhance data-sources page with health summary, staleness viz, expandable rows |
| `7086dc5` | 21-02 metadata | Docs commit for plan 02 |
| `5287019` | 21-03 Task 1 | Add adapter detail drawer with Sync Now and paginated history |

---

## Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Finding |
|------|---------|---------|---------|
| All Plan 01 files | TODO/FIXME | — | None found |
| `page.tsx` | Stub implementations | — | None found — all handlers are fully implemented |
| `page.tsx` | Empty returns | — | No `return null` or `return {}` stubs |

One pre-existing TypeScript issue flagged in Plan 02 SUMMARY: route.test.ts files have TS errors unrelated to page.tsx changes. These pre-date this phase and are out of scope.

---

## Human Verification Required

Plans 02 and 03 each contained a `checkpoint:human-verify` task that was marked as approved in the respective SUMMARYs. The following behaviors were human-verified interactively:

**Plan 02 — All 13 steps confirmed:**
- Pipeline status pill with color, health filter cards, filter toggle behavior, amber/red row tints, stale-first table order, dual badge display, Last Sync interval labels, expand chevron, inline sync history, error tooltip, health + tier filter combination.

**Plan 03 — All 11 steps confirmed:**
- Drawer opens on adapter name click, config summary display, full error in drawer, sync history with timestamps/badges/records/durations, Load More pagination, Sync Now spinner, post-sync auto-refresh of drawer + table + health cards, drawer close behavior, independent chevron + name click paths.

These human checkpoints are the compensating control for the client-side logic in `page.tsx` that has no unit tests (filter chaining, sort order, render behavior), as explicitly acknowledged in Plan 02.

---

## Gaps Summary

No gaps. All 17 observable truths verified, all 5 artifacts substantive and wired, all 5 key link groups wired, all 5 requirements satisfied with implementation evidence.

---

_Verified: 2026-03-12T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
