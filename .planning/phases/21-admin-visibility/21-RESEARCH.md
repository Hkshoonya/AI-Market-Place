# Phase 21: Admin Visibility - Research

**Researched:** 2026-03-12
**Domain:** Next.js admin dashboard — expandable table rows, slide-out drawer, SWR on-demand fetch, shadcn Sheet/Tooltip/Skeleton, pipeline health API integration
**Confidence:** HIGH

## Summary

Phase 21 enhances the existing `/admin/data-sources` page (`page.tsx`, 473 lines already live) with four new UI capabilities: expandable inline sync history rows, staleness visualization, a drawer detail view per adapter, and real-time pipeline health summary cards. All underlying data already exists in the database (`sync_jobs`, `pipeline_health`, `data_sources` tables) and all required API routes either exist or need small additions.

The most architecturally significant change is adding an admin-authenticated path to the pipeline health data. The existing `/api/pipeline/health` endpoint returns full per-adapter detail only via `Bearer CRON_SECRET` — the admin dashboard uses cookie-based session auth, not that token. The solution is to either (a) add a new `/api/admin/pipeline/health` route that uses session auth + admin check and returns the same detail payload, or (b) extend `/api/admin/data-sources` GET to JOIN health data inline. Option (a) is cleaner and keeps the existing public health endpoint untouched.

The secondary complexity is `sync_jobs.status` vocabulary mismatch: the orchestrator writes `"running"` | `"completed"` | `"failed"` (see `orchestrator.ts` lines 137-158), while `data_sources.last_sync_status` uses `"success"` | `"partial"` | `"failed"`. The sync history UI must map `"completed"` → display as success. Additionally, `formatRelativeDate` is day-granular (Today/Yesterday/Nd ago) and is insufficient for sync history timestamps that may differ by minutes or hours — a new `formatRelativeTime` helper (hours/minutes aware) is needed.

**Primary recommendation:** Add `/api/admin/pipeline/health` (session-auth), extend `/api/admin/sync` to accept `?source=` filter, enhance `page.tsx` with expandable rows + Sheet drawer + health badges + staleness tint, all following existing SWR/shadcn/lucide patterns.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sync history display:**
- Expandable rows in the existing data-sources table — click chevron to expand inline history
- Show last 10 sync runs per adapter
- On-demand fetch via SWR when row is expanded (not preloaded)
- Each entry shows: timestamp, status badge, records count, duration
- Failed entries show truncated error message (~80 chars) inline, full message on hover tooltip

**Staleness visualization:**
- Stale rows get a subtle background tint: amber for degraded, red for down
- "Last Sync" column shows expected interval: e.g. "14h ago (every 6h)"
- Table sorted stale-first: down at top, then degraded, then healthy; within each group sorted by tier
- Both sync status (success/partial/failed) AND health status (healthy/degraded/down) displayed per adapter — two separate badges

**Adapter detail view:**
- Slide-out drawer from the right side, triggered by clicking the adapter name (not the expand chevron)
- Drawer shows: adapter config summary at top (tier, sync interval, output types, secret status, consecutive failure count)
- Full error message from most recent failure displayed in drawer (not truncated)
- Sync history: last 25 entries, paginated with "Load more" button
- "Sync Now" button in drawer header with spinner during sync, auto-refreshes drawer content on completion

**Pipeline health summary:**
- Replace existing 4 summary cards with: Healthy (count), Degraded (count), Down (count), Records Synced
- Add a top-level pipeline status pill/banner above the cards: "Pipeline: Degraded · Last run: 2m ago" — color-coded green/amber/red
- Health data fetched from `/api/pipeline/health` (Phase 20 endpoint) — single source of truth
- Summary cards are clickable to filter the table by health status (works alongside existing tier filter, click again to clear)

### Claude's Discretion
- Exact drawer component implementation (shadcn Sheet vs custom)
- Expand/collapse animation for inline history rows
- Exact tooltip implementation for truncated errors
- Whether to show a "no sync jobs" empty state in expanded row vs hiding expand chevron
- Loading skeleton design for on-demand sync history fetch
- Pagination implementation for drawer sync logs (cursor vs offset)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Admin dashboard shows sync job history (status, errors, timestamps, records processed) | `sync_jobs` table already populated by orchestrator; `/api/admin/sync` returns last 50 jobs; needs `?source=` filter param and on-demand SWR in expandable row |
| ADMN-02 | Admin dashboard highlights stale data sources (no successful sync within expected interval) | `pipeline_health.last_success_at` + `expected_interval_hours` drive staleness; health endpoint already computes degraded/down; row background tint via Tailwind conditional classes |
| ADMN-03 | Admin dashboard shows pipeline health overview (healthy/degraded/down per adapter) | `/api/pipeline/health` exists but requires CRON_SECRET for full detail; need new `/api/admin/pipeline/health` with session auth to expose per-adapter breakdown to admin UI |
| ADMN-04 | Admin can drill down to per-adapter error details and recent sync logs | shadcn `Sheet` component already in `src/components/ui/sheet.tsx`; adapter detail fetched on-demand via SWR when sheet opens |
| ADMN-05 | Admin can manually trigger a sync for any individual adapter from the dashboard | `POST /api/admin/sync/[source]` already wired to `runSingleSync`; "Sync Now" in drawer calls same endpoint, then `mutate()` to refresh drawer SWR |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SWR | Already installed | On-demand data fetching for expanded rows and drawer content | Used by all admin pages; `SWR_TIERS` config already established |
| shadcn Sheet | Already installed | Right-side drawer for adapter detail view | Already in `src/components/ui/sheet.tsx`; uses Radix Dialog primitive |
| shadcn Tooltip | Already installed | Hover tooltip for truncated error messages | Already in `src/components/ui/tooltip.tsx`; uses Radix Tooltip primitive |
| shadcn Skeleton | Already installed | Loading placeholder for on-demand sync history fetch | Already in `src/components/ui/skeleton.tsx` |
| lucide-react | Already installed | Chevron icons for expand/collapse, status icons | Consistent with existing admin icon usage |
| Tailwind CSS | Already installed | Conditional row background tint for staleness | `bg-amber-400/10` (degraded), `bg-red-500/10` (down) pattern |
| sonner (toast) | Already installed | Sync result notifications in drawer | Already used in `page.tsx` for sync feedback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn()` from `@/lib/utils` | Already installed | Conditional class merging for row tint | Combine base row classes with staleness tint conditionally |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Sheet | Custom overlay div | Sheet already installed; Radix handles focus trap, ARIA, keyboard dismiss |
| SWR on-demand | `useEffect` + `fetch` | SWR provides deduplication, caching, and revalidation for free |
| shadcn Tooltip | CSS `title` attribute | Tooltip gives styled overlay; `title` tooltip is unstyled and inconsistent across browsers |

**Installation:** No new packages required — all components already present.

---

## Architecture Patterns

### Recommended Project Structure

The entire phase is a modification of one existing page file plus three supporting additions:

```
src/
├── app/(admin)/admin/data-sources/
│   └── page.tsx                     # PRIMARY: add expandable rows, drawer, health badges, staleness
├── app/api/admin/
│   ├── sync/route.ts                # MODIFY: add ?source= query param support
│   └── pipeline/health/route.ts    # NEW: admin-session-authed health detail endpoint
└── lib/
    └── format.ts                    # MODIFY: add formatRelativeTime() for minute/hour granularity
```

### Pattern 1: SWR On-Demand Fetch (Conditional Key)

SWR's conditional fetch pattern — pass `null` as key to disable, switch to URL string to trigger fetch. Used for both expandable row history and drawer content.

**What:** Fetch only when user expands a row or opens a drawer.
**When to use:** Anytime data is only needed on user interaction, not on page load.

```typescript
// Source: SWR docs — conditional fetching
const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

const { data: historyData, isLoading: historyLoading } = useSWR(
  expandedSlug ? `/api/admin/sync?source=${expandedSlug}&limit=10` : null,
  { ...SWR_TIERS.SLOW }
);
```

For the drawer, key off the selected adapter slug:

```typescript
const [drawerSlug, setDrawerSlug] = useState<string | null>(null);

const { data: drawerHistory, mutate: mutateDrawer } = useSWR(
  drawerSlug ? `/api/admin/sync?source=${drawerSlug}&limit=25` : null,
  { ...SWR_TIERS.SLOW }
);
```

### Pattern 2: Expandable Table Rows with Chevron

The existing table uses raw `<tr>` elements (not shadcn Table component). Expandable rows add a chevron column and a conditional secondary row.

```typescript
// Source: existing page.tsx pattern — raw table rows
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

const toggleRow = (slug: string) => {
  setExpandedRows(prev => {
    const next = new Set(prev);
    if (next.has(slug)) { next.delete(slug); } else { next.add(slug); }
    return next;
  });
};

// In render: add a collapse row after each expanded source row
{isExpanded && (
  <tr key={`${source.id}-history`} className="border-b border-border/30 bg-secondary/10">
    <td colSpan={9} className="px-4 py-3">
      <SyncHistoryInline slug={source.slug} />
    </td>
  </tr>
)}
```

**Note:** A new column "Expand" needs to be added to the table header (chevron column, leftmost or after Actions). Column count increases from 7 to 8 (adding health badge column) or 9 (adding expand chevron). The `colSpan` on the expanded row must match.

### Pattern 3: Staleness Row Tinting

Derive health status for each source from the fetched pipeline health data, then apply Tailwind bg classes conditionally using `cn()`.

```typescript
// Staleness tint — applied to <tr> className
const rowBg = healthStatus === "down"
  ? "bg-red-500/5 hover:bg-red-500/10"
  : healthStatus === "degraded"
  ? "bg-amber-400/5 hover:bg-amber-400/10"
  : "hover:bg-secondary/20";

<tr className={cn("border-b border-border/30 transition-colors", rowBg)}>
```

### Pattern 4: Sheet Drawer for Adapter Detail

`Sheet` from `src/components/ui/sheet.tsx` uses Radix `Dialog` primitive with `side="right"`. The existing `SheetContent` defaults to `sm:max-w-sm` — for adapter detail with sync logs, consider a wider variant.

```typescript
// Source: src/components/ui/sheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

<Sheet open={!!drawerSlug} onOpenChange={(open) => !open && setDrawerSlug(null)}>
  <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{selectedSource?.name}</SheetTitle>
    </SheetHeader>
    {/* Config summary, sync history, Sync Now button */}
  </SheetContent>
</Sheet>
```

**Note:** `SheetContent` does not have a `data-slot="sheet-content"` scroll by default — add `overflow-y-auto` to the SheetContent className to allow the drawer body to scroll past the viewport.

### Pattern 5: Admin Pipeline Health Endpoint (New)

The existing `/api/pipeline/health` returns full detail only with `Bearer CRON_SECRET`. The admin page authenticates via session cookie. Solution: new route at `/api/admin/pipeline/health` that uses the same admin auth check pattern as other admin routes, then queries `data_sources` + `pipeline_health` and computes status identically to the existing health route.

```typescript
// Pattern: matches all other admin routes
// GET /api/admin/pipeline/health
// Auth: session cookie + profiles.is_admin check
// Returns: PipelineHealthDetailSchema (same shape as authenticated /api/pipeline/health)
```

The `computeStatus()` function logic can be extracted to a shared lib (`src/lib/pipeline-health-compute.ts`) to avoid duplication between the two health routes.

### Pattern 6: Adding `?source=` Filter to Sync Route

The existing `/api/admin/sync` GET reads the last 50 jobs unfiltered. Add optional `?source=` query param:

```typescript
// Source: existing route.ts pattern
const source = request.nextUrl.searchParams.get("source");
const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);

let query = supabase.from("sync_jobs").select("*").order("created_at", { ascending: false }).limit(limit);
if (source) { query = query.eq("source", source); }
```

### Pattern 7: `formatRelativeTime` Helper

`formatRelativeDate` (existing in `src/lib/format.ts`) is day-granular. Sync jobs that ran 2 hours ago need sub-day granularity. Add a new helper:

```typescript
// Add to src/lib/format.ts
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatRelativeDate(dateStr); // fall back for older
}
```

### Pattern 8: Table Sort — Stale-First

Sort is computed client-side (API returns all sources, filter is client-side already). Health status priority: down=0, degraded=1, healthy=2. Within each group, sort by tier ascending.

```typescript
const HEALTH_PRIORITY = { down: 0, degraded: 1, healthy: 2 };

const sortedSources = [...filteredSources].sort((a, b) => {
  const ha = healthBySlug.get(a.slug)?.status ?? "healthy";
  const hb = healthBySlug.get(b.slug)?.status ?? "healthy";
  const hDiff = HEALTH_PRIORITY[ha] - HEALTH_PRIORITY[hb];
  if (hDiff !== 0) return hDiff;
  return a.tier - b.tier;
});
```

### Anti-Patterns to Avoid

- **Preloading all sync histories on page load:** The page shows 26+ adapters. Loading 10 jobs each on mount = 260+ rows fetched before user sees anything. Use on-demand SWR with null key.
- **Storing drawer state as the full source object:** Store only the `slug` string as `drawerSlug`; derive the full source object from `allSources.find(s => s.slug === drawerSlug)`. This avoids stale object references after `mutate()`.
- **Using the existing `/api/pipeline/health` with CRON_SECRET in browser:** Never expose `CRON_SECRET` to the client. Use a new admin-session-authenticated endpoint.
- **Using `formatRelativeDate` for sync job timestamps:** It only has day granularity (Today/Yesterday). Sync history timestamps need minute/hour granularity — use the new `formatRelativeTime`.
- **Hardcoding `colSpan` without updating for new columns:** The inline history expansion row uses `colSpan`. Adding new columns (health badge, expand chevron) changes the total column count from 7 to 9. The colSpan must match exactly or the expanded row layout breaks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Right-side drawer | Custom overlay + portal | `Sheet` from `@/components/ui/sheet` | Already installed; handles focus trap, scroll lock, keyboard dismiss, ARIA, animation |
| Hover tooltip for truncated errors | CSS `title` attribute or custom hover div | `Tooltip/TooltipTrigger/TooltipContent` from `@/components/ui/tooltip` | Already installed; handles positioning, z-index, portal rendering, Radix accessibility |
| Loading placeholder for sync history | Animated `div` with inline styles | `Skeleton` from `@/components/ui/skeleton` | Matches existing loading pattern in `page.tsx` row skeletons |
| Status computation (healthy/degraded/down) | Re-implement in client | Extract `computeStatus()` from `/api/pipeline/health/route.ts` to shared lib | Avoids drift between endpoint and UI — single source of truth |

**Key insight:** All four UI primitives (Sheet, Tooltip, Skeleton, status computation) are already available in the codebase. The work is wiring them together, not building them.

---

## Common Pitfalls

### Pitfall 1: `sync_jobs.status` Vocabulary Mismatch
**What goes wrong:** The orchestrator writes `"completed"` (not `"success"`) and `"failed"` to `sync_jobs.status`. But `data_sources.last_sync_status` and the existing `STATUS_CONFIG` in `page.tsx` use `"success"` | `"partial"` | `"failed"`. If the sync history UI renders raw DB status values, "completed" will not match any `STATUS_CONFIG` key and will render as undefined/blank.
**Why it happens:** Two separate vocabulary systems: the sync orchestrator uses job lifecycle terms (`running/completed/failed`), the data_sources column uses outcome terms (`success/partial/failed`).
**How to avoid:** Add a display mapper for sync job status: `"completed" → "success"`, `"failed" → "failed"`, `"running" → "running"`. Also handle `"partial"` from metadata if stored there. Never directly index `STATUS_CONFIG` with a raw `sync_jobs.status` value.
**Warning signs:** Inline history shows blank badges or undefined status text.

### Pitfall 2: Pipeline Health Auth Gap
**What goes wrong:** Fetching `/api/pipeline/health` from the admin browser client returns only the summary (no `adapters[]` array) unless `Authorization: Bearer <CRON_SECRET>` is sent. Admin pages authenticate via session cookie, not CRON_SECRET. Building the health summary cards and staleness sort directly against the public endpoint gives counts but no per-adapter status.
**Why it happens:** The health endpoint was designed for cron monitoring (Bearer token auth) and public consumption (summary only), not admin session auth.
**How to avoid:** Create `/api/admin/pipeline/health` with session-cookie auth + `profiles.is_admin` check, returning the full detail payload. Admin page fetches this endpoint.
**Warning signs:** `adapters` field is undefined in the health response; per-adapter health badges don't render.

### Pitfall 3: Sheet Default Width Too Narrow
**What goes wrong:** The default `SheetContent` with `side="right"` is constrained to `sm:max-w-sm` (384px). An adapter detail drawer with config summary + sync history + error messages + pagination is cramped at that width.
**Why it happens:** The shadcn Sheet default is designed for navigation drawers, not content panels.
**How to avoid:** Override with `className="sm:max-w-lg"` (512px) or `sm:max-w-xl` (576px). Ensure `overflow-y-auto` is also applied so the drawer scrolls when history is long.
**Warning signs:** Error messages wrap excessively, sync log table columns are too tight.

### Pitfall 4: SWR Cache Sharing Between Rows
**What goes wrong:** Two adapters expanded simultaneously share SWR cache if both use the same key. Conversely, using `mutate()` on a specific SWR key in the drawer after "Sync Now" does not refresh the inline row history (different key).
**Why it happens:** SWR caches by key string. Drawer uses `?limit=25`, inline row uses `?limit=10` — different keys, independent caches.
**How to avoid:** After "Sync Now" in drawer, call `mutate()` on both the drawer key AND the inline row key if the row is expanded. Also `mutate()` the main `/api/admin/data-sources` key to refresh the source's `last_sync_at`/`last_sync_status`.
**Warning signs:** "Sync Now" completes but inline history row still shows old data.

### Pitfall 5: Health Filter State Conflicts with Tier Filter
**What goes wrong:** The CONTEXT requires that clicking a health summary card filters the table by health status, working alongside the existing tier filter. If both are applied simultaneously without coordination, sources might appear that match tier but not health, or vice versa.
**Why it happens:** Two independent filters applied to the same array.
**How to avoid:** Chain filters: first apply tier filter, then health filter. Both operate on `allSources`. Make card click toggle (second click clears). The health filter state is separate from `tierFilter` state.
**Warning signs:** Filtering by "Down" and "Tier 1" together shows empty table even when down Tier 1 sources exist.

### Pitfall 6: `formatRelativeDate` Granularity for Recent Sync Jobs
**What goes wrong:** Using the existing `formatRelativeDate` for sync history timestamps shows "Today" for a job that ran 30 minutes ago and "Today" for one that ran 8 hours ago — indistinguishable.
**Why it happens:** `formatRelativeDate` uses `Math.floor(diffMs / (1000 * 60 * 60 * 24))` — loses sub-day granularity.
**How to avoid:** Use the new `formatRelativeTime` helper (minutes/hours aware) for sync job timestamps. Keep `formatRelativeDate` for the "Last Sync" column on the main source row where day-level granularity is acceptable.
**Warning signs:** Sync history shows "Today" for multiple entries with different actual times.

---

## Code Examples

### Existing Admin Auth Pattern (from `/api/admin/sync/route.ts`)
```typescript
// Source: src/app/api/admin/sync/route.ts — established pattern for all admin routes
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: profile } = await supabase
  .from("profiles")
  .select("is_admin")
  .eq("id", user.id)
  .single();
if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### Health Status Computation (from `/api/pipeline/health/route.ts`)
```typescript
// Source: src/app/api/pipeline/health/route.ts — extract this to shared lib
function computeStatus(row: {
  consecutive_failures: number;
  last_success_at: string | null;
  expected_interval_hours: number;
}): "healthy" | "degraded" | "down" {
  const failures = row.consecutive_failures;
  const intervalMs = row.expected_interval_hours * 60 * 60 * 1000;
  const sinceLastSync = row.last_success_at
    ? Date.now() - new Date(row.last_success_at).getTime()
    : Infinity;

  if (failures >= 3 || sinceLastSync > 4 * intervalMs) return "down";
  if (failures >= 1 || sinceLastSync > 2 * intervalMs) return "degraded";
  return "healthy";
}
```

### SyncJob DB Schema (from `src/types/database.ts`)
```typescript
// Source: src/types/database.ts
export interface SyncJob {
  id: string;                          // uuid
  source: string;                      // adapter slug
  job_type: string;                    // "scheduled" | "manual"
  status: string;                      // "running" | "completed" | "failed"
  started_at: string | null;
  completed_at: string | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null; // includes duration_ms, tier, adapter_type, trigger
  created_at: string;
}
// NOTE: duration_ms is stored in metadata.duration_ms by orchestrator (not a top-level column)
```

### Sync Now in Drawer Pattern
```typescript
// Adapted from existing triggerSync in page.tsx — drawer variant
const triggerSyncFromDrawer = async (slug: string) => {
  setDrawerSyncing(true);
  try {
    const res = await fetch(`/api/admin/sync/${slug}`, { method: "POST" });
    if (!res.ok) throw new Error("Sync failed");
    toast.success("Sync completed");
    // Refresh drawer history AND main source row AND health counts
    await Promise.all([
      mutateDrawer(),
      mutate(),           // main /api/admin/data-sources
      mutateHealth(),     // /api/admin/pipeline/health
    ]);
  } catch {
    toast.error("Sync failed");
  } finally {
    setDrawerSyncing(false);
  }
};
```

### Tooltip for Truncated Errors
```typescript
// Source: src/components/ui/tooltip.tsx — existing component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Wrap TooltipProvider at page level (or around the table)
<TooltipProvider>
  {syncJob.error_message && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-[11px] text-loss line-clamp-1 cursor-help">
          {syncJob.error_message.slice(0, 80)}{syncJob.error_message.length > 80 ? "…" : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-wrap">
        {syncJob.error_message}
      </TooltipContent>
    </Tooltip>
  )}
</TooltipProvider>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single sync status badge per adapter | Two badges: sync status (success/partial/failed) + health status (healthy/degraded/down) | Phase 21 | Distinguishes last run outcome from ongoing health trend |
| Static 4 summary cards (Enabled/Healthy/Failed/Records) | Dynamic health cards (Healthy/Degraded/Down/Records) + pipeline status pill | Phase 21 | Cards now clickable to filter; pill shows overall pipeline state |
| "Last Sync" shows timestamp only | "Last Sync" shows "14h ago (every 6h)" — relative to expected interval | Phase 21 | Admin immediately sees if overdue without knowing the schedule |

**Deprecated/outdated in this phase:**
- Existing `STATUS_CONFIG` (success/partial/failed) in `page.tsx`: still needed for sync status badge, but a new `HEALTH_CONFIG` (healthy/degraded/down) is added alongside it.
- Existing 4 summary card static array: replaced with health-aware cards from pipeline health API data.

---

## Open Questions

1. **`sync_jobs` table RLS — admin readable?**
   - What we know: `sync_jobs` has RLS enabled with no public SELECT policy (migration 001 says "sync_jobs are NOT publicly readable — only service role"). The existing `/api/admin/sync` GET uses `createClient()` (session client, not service role), which may return 0 rows if RLS blocks it.
   - What's unclear: Whether there's an admin RLS policy (e.g., `FOR SELECT USING (auth.role() = 'authenticated')` or similar) that was added later. The migration files don't show an admin-read policy.
   - Recommendation: Test the existing `/api/admin/sync` GET in a real session to confirm it returns data. If it returns empty, add an RLS policy: `CREATE POLICY "Admin read sync_jobs" ON sync_jobs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));` OR switch to `createAdminClient()` (service role) in the sync route.

2. **`pipeline_health` table RLS — is it readable via session client?**
   - What we know: Migration 014 creates `pipeline_health` but no RLS policy is shown for it. The `/api/pipeline/health` route uses `createAdminClient()` (service role). The new `/api/admin/pipeline/health` route will need to read it — if RLS is not enabled on this table, `createClient()` (session auth) will work fine.
   - What's unclear: Whether `ENABLE ROW LEVEL SECURITY` was applied to `pipeline_health` but not shown in the migration excerpts.
   - Recommendation: Use `createAdminClient()` in the new `/api/admin/pipeline/health` route (consistent with the existing health route) to avoid RLS uncertainty.

3. **Duration display in sync history**
   - What we know: `duration_ms` is stored in `sync_jobs.metadata.duration_ms` (set by orchestrator at line 155), NOT as a top-level column.
   - What's unclear: Whether `metadata` might be null or missing `duration_ms` for very old jobs or edge-case runs.
   - Recommendation: Read duration as `job.metadata?.duration_ms` with null fallback. Display as `<1s` for under 1000ms, `Xs` for under 60s, `Xm Ys` for longer. Never show "—" for duration on completed jobs where metadata exists.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest with React Testing Library |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | `/api/admin/sync?source=X` filters by source | unit | `npx vitest run src/app/api/admin/sync/route.test.ts` | ❌ Wave 0 |
| ADMN-01 | `/api/admin/sync?limit=10` respects limit param | unit | `npx vitest run src/app/api/admin/sync/route.test.ts` | ❌ Wave 0 |
| ADMN-02 | Staleness sort (down → degraded → healthy) computed correctly | unit | `npx vitest run src/lib/pipeline-health-compute.test.ts` | ❌ Wave 0 |
| ADMN-03 | `/api/admin/pipeline/health` returns 401 without auth | unit | `npx vitest run src/app/api/admin/pipeline/health/route.test.ts` | ❌ Wave 0 |
| ADMN-03 | `/api/admin/pipeline/health` returns 403 for non-admin | unit | `npx vitest run src/app/api/admin/pipeline/health/route.test.ts` | ❌ Wave 0 |
| ADMN-03 | `/api/admin/pipeline/health` returns full adapter detail for admin | unit | `npx vitest run src/app/api/admin/pipeline/health/route.test.ts` | ❌ Wave 0 |
| ADMN-04/05 | `formatRelativeTime` sub-day granularity | unit | `npx vitest run src/lib/format.test.ts` | ❌ Wave 0 |
| ADMN-04/05 | sync_jobs status mapping (completed → success display) | unit | `npx vitest run src/lib/pipeline-health-compute.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/app/api/admin/sync/route.test.ts` — covers ADMN-01 (source filter, limit param, auth check)
- [ ] `src/app/api/admin/pipeline/health/route.test.ts` — covers ADMN-03 (auth, admin check, payload shape)
- [ ] `src/lib/pipeline-health-compute.test.ts` — covers ADMN-02 (status computation, staleness sort)
- [ ] `src/lib/format.test.ts` — covers `formatRelativeTime` sub-day granularity
- [ ] Extract `computeStatus()` to `src/lib/pipeline-health-compute.ts` (shared between two routes + tests)

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection — all findings derived from reading actual project files
- `src/app/(admin)/admin/data-sources/page.tsx` — existing 473-line page, table structure, state patterns
- `src/app/api/admin/sync/route.ts` — existing sync history endpoint
- `src/app/api/admin/sync/[source]/route.ts` — existing manual sync trigger
- `src/app/api/pipeline/health/route.ts` — full health computation logic
- `src/lib/data-sources/orchestrator.ts` — sync_jobs field writes, status vocabulary
- `src/types/database.ts` — SyncJob interface, DataSource interface, pipeline_health schema
- `src/components/ui/sheet.tsx` — Sheet component API and default sizing
- `src/components/ui/tooltip.tsx` — Tooltip component API
- `src/components/ui/skeleton.tsx` — Skeleton component API
- `src/lib/swr/config.ts` — SWR tier constants
- `src/lib/format.ts` — formatRelativeDate granularity limitation
- `supabase/migrations/001_initial_schema.sql` — sync_jobs table definition + RLS statement
- `supabase/migrations/014_multi_lens_scoring.sql` — pipeline_health table definition
- `vitest.config.ts` — test framework configuration

### Secondary (MEDIUM confidence)
- None needed — all critical facts sourced from project files directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified to exist in the project
- Architecture: HIGH — derived from reading actual source files, not documentation
- Pitfalls: HIGH — discovered by cross-reading the orchestrator, route handlers, and DB schema directly
- Open questions: MEDIUM — identified gaps where source code alone is ambiguous (RLS policies not fully visible in migrations)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain — shadcn components and SWR patterns are stable)
