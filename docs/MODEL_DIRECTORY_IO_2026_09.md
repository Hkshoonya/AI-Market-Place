# Model Directory IO Follow-Up

Date: 2026-09-13. This builds on the database/agent work in PR 43 and
`SUPABASE_DISK_IO_2026_09.md`. Payments, billing migration 099, paid compute,
scheduler frequency, and data retention are unchanged.

## Reproduced Failures

- The uncached directory loaded up to 10,000 full model records, approximately
  15.5 MB, with a nine-query burst after the first page.
- Its deployment lookup generated a 221,976-byte PostgREST URL containing
  thousands of model UUIDs. Supabase returned HTTP 414; the page ignored that
  error and lost availability/access offers. An unpaginated replacement would
  also be wrong: 5,182 available deployments exceed the 1,000-row response cap.
- Family matching repeatedly tokenized every built-in provider catalogue entry
  for each model. A synthetic 10,000-model deduplication took 11,910 ms.
- Invalid page values could produce incorrect slices, and an empty filtered
  result fell back to the unfiltered count, advertising nonexistent pages.

## Changes

Candidate reads select only the fields used by matching, readiness, filtering,
and fallback rendering. Full details and pricing are hydrated for the visible
20 model IDs. Candidate pages have 500 rows, a unique UUID ordering tie-breaker,
and at most two concurrent cold reads. The existing 10,000-candidate cap and
full tracked-artifact count are retained; this does not make the directory an
unbounded catalogue export.

Public candidate pages and paginated available deployments use the established
Next data-cache pattern with 300-second revalidation. Page/view/deployable
toggles share candidates, while all database filters participate in the key.
Free text, arbitrary providers, and invalid category/license filters do not
create persistent cache entries. Only anonymous public clients are used: no
cookies, credentials, or user-specific data enter the shared cache. This is
stale-while-revalidate, not a guarantee of fresh data exactly every five minutes;
upstream failures can retain previously cached successful data. Cold read
failures propagate rather than silently publishing an incomplete catalogue.

Deployment availability is fetched in stable, bounded pages and matched locally
instead of putting thousands of IDs into an IN URL. Metadata matching prepares
static provider tokens once, preserves exact/subset precedence, retains the
version-mismatch guard, and checks the bounded full-identity cache first.
Pagination controls use the same validated page as the server.

## Online Database Change

Stable rank/UUID ordering revealed an incremental sort spill on late pages.
Migration 102 adds `idx_models_status_rank_id` on `(status, overall_rank, id)`.
It was applied as a standalone concurrent index build on production. The index
is valid and ready, its definition was verified, and its size is 848 KB.
Existing indexes were retained for the review/rollback window. No data rows,
RLS policies, grants, or global database settings changed.

For the same 500-row page after offset 9,500, a live EXPLAIN ANALYZE sample
changed from 89 ms with 426 temporary blocks read / 445 written to 13 ms with
zero temporary blocks and no Sort node. The previous spill peaked at 3,544 KB.
These are workload-dependent samples, not a sustained production benchmark.
Cached buffer accesses increased from 2,458 to 10,052 because the ordered index
walks past the offset; cold pagination still has that cost. The shared cache
reduces repeated walks, and no additional indexes were added speculatively for
every optional sort.

As with migration 100, do not run migration 102 inside a transaction. Verify
`indisvalid`, `indisready`, and `pg_get_indexdef` after any retry; IF NOT EXISTS
alone does not repair an invalid index. Application rollback does not require
dropping this compatible index.

## Verification And Remaining Work

- Unit suite: 1,873 passed; final targeted directory/metadata/family run: 49
  passed. Component suite: 362 passed across 152 files. Typecheck and lint passed.
- Old/new metadata comparison: 2,772 built-in catalogue lookup cases with no
  mismatched results. The same synthetic 10,000-model deduplication took 1,630 ms
  after the optimization, versus 11,910 ms before.
- Next actually stored 26 public catalogue/deployment cache entries in local
  verification, approximately 10.5 MB total; the largest observed entry was
  509,842 bytes. Future unusually large descriptions/pricing still need cache
  size monitoring. The schema does not truncate descriptions to force a limit.
- Browser verification against the local app using only production public/anon
  read access: directory list, page two, deployable grid, and 390px mobile view
  rendered. Twenty results appeared, page two was selected, no framework overlay
  or browser errors were recorded, and mobile had no horizontal overflow.
- Local development responses were approximately 7.7-8.9 seconds in the final
  samples; a production observation before this application change was about
  20 seconds. Different environments, compilation, cache state, and concurrent
  work mean this is not a controlled production before/after comparison.
- Production health at 22:18 UTC: 37 healthy sources, no degraded/down sources,
  zero failed cron runs in 24 hours, and a fresh external scheduler. Database
  size was 804 MB; the six previous IO indexes remained valid and ready.
- Production still runs commit `9002cded`; PR 43 and this application follow-up
  require review and release. No branch-protection bypass or manual deployment
  was performed. Recheck production routes and agent runs after deployment,
  compare IO over equal windows, and inspect the Supabase Disk IO budget graph.
  Warning clearance and sustained budget recovery are not yet verified.

Reference: [PostgreSQL concurrent index guidance](https://www.postgresql.org/docs/17/sql-createindex.html).
