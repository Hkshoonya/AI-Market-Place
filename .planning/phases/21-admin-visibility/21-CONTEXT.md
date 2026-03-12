# Phase 21: Admin Visibility - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can see exactly what the pipeline is doing — which syncs ran, which failed, which sources are stale — and can trigger a resync for any adapter from the dashboard without touching the database or code.

Requirements: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05

</domain>

<decisions>
## Implementation Decisions

### Sync history display
- Expandable rows in the existing data-sources table — click chevron to expand inline history
- Show last 10 sync runs per adapter
- On-demand fetch via SWR when row is expanded (not preloaded)
- Each entry shows: timestamp, status badge, records count, duration
- Failed entries show truncated error message (~80 chars) inline, full message on hover tooltip

### Staleness visualization
- Stale rows get a subtle background tint: amber for degraded, red for down
- "Last Sync" column shows expected interval: e.g. "14h ago (every 6h)"
- Table sorted stale-first: down at top, then degraded, then healthy; within each group sorted by tier
- Both sync status (success/partial/failed) AND health status (healthy/degraded/down) displayed per adapter — two separate badges

### Adapter detail view
- Slide-out drawer from the right side, triggered by clicking the adapter name (not the expand chevron)
- Drawer shows: adapter config summary at top (tier, sync interval, output types, secret status, consecutive failure count)
- Full error message from most recent failure displayed in drawer (not truncated)
- Sync history: last 25 entries, paginated with "Load more" button
- "Sync Now" button in drawer header with spinner during sync, auto-refreshes drawer content on completion

### Pipeline health summary
- Replace existing 4 summary cards with: Healthy (count), Degraded (count), Down (count), Records Synced
- Add a top-level pipeline status pill/banner above the cards: "Pipeline: ⚠ Degraded · Last run: 2m ago" — color-coded green/amber/red
- Health data fetched from `/api/pipeline/health` (Phase 20 endpoint) — single source of truth
- Summary cards are clickable to filter the table by health status (works alongside existing tier filter, click again to clear)

### Claude's Discretion
- Exact drawer component implementation (shadcn Sheet vs custom)
- Expand/collapse animation for inline history rows
- Exact tooltip implementation for truncated errors
- Whether to show a "no sync jobs" empty state in expanded row vs hiding expand chevron
- Loading skeleton design for on-demand sync history fetch
- Pagination implementation for drawer sync logs (cursor vs offset)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/admin/data-sources/page.tsx`: Existing 473-line data-sources page with table, summary cards, tier filter, sync button, enable/disable toggle — this is the page being enhanced
- `/api/admin/data-sources/route.ts`: GET returns all data_sources, PATCH toggles enable/disable — may need to join pipeline_health data
- `/api/admin/sync/route.ts`: GET returns last 50 sync_jobs — already available, needs per-adapter filtering param
- `/api/admin/sync/[source]/route.ts`: POST triggers single adapter sync via `runSingleSync` — already wired to Sync button
- `/api/pipeline/health/route.ts`: Phase 20 endpoint returning per-adapter health status — use for summary cards and health badges
- `pipeline_health` table: tracks `consecutive_failures`, `last_success_at`, `expected_interval_hours` per adapter
- `SWR_TIERS` config (`src/lib/swr/config.ts`): Tiered revalidation config — use for on-demand fetch caching
- `formatRelativeDate` (`src/lib/format.ts`): Already used for "Last Sync" column
- `Card`, `Badge`, `Button` from `@/components/ui/`: shadcn components already used throughout admin
- `toast` from `sonner`: Already used for sync success/failure notifications

### Established Patterns
- `useSWR` with `SWR_TIERS`: All admin pages use SWR for data fetching — new fetches (sync history, pipeline health) must follow
- `handleApiError` + `createTaggedLogger`: Used in all 65 API routes — any new/modified endpoints must follow
- Admin auth check pattern: `getUser()` → `profiles.is_admin` check — already in all admin API routes
- `rateLimit` with `RATE_LIMITS`: Applied to all admin endpoints
- lucide-react icons: Consistent icon library across the app

### Integration Points
- Data sources table (`page.tsx`): Primary file being modified — add expandable rows, drawer trigger, health badges, staleness tint
- Summary cards section: Replace existing 4 cards with health-aware cards + status pill
- Tier filter section: Add health status filter alongside existing tier buttons
- `/api/admin/sync/route.ts`: May need query param to filter by source slug for on-demand history
- Admin layout (`layout.tsx`): No changes needed — "Sources" nav tab already exists

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user chose recommended approaches for all areas. Implementation should follow existing admin page patterns (SWR data fetching, shadcn components, lucide icons, Tailwind styling).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-admin-visibility*
*Context gathered: 2026-03-12*
