# Supabase Disk IO Remediation, 2026-09-13

## Diagnosis

Production project `supabase-emerald-book` was healthy but under memory and read
pressure. Its 8 GB data volume had about 1.40 GB used and 6.95 GB available.
The warning concerns IO throughput/budget, not a nearly full data volume.

The metrics endpoint reported approximately 411 MiB of memory and 670-714 MiB
of occupied swap. Sampling confirmed active swap traffic. No paid compute or
disk upgrade was made. Historical query statistics extend back to February 21;
their accumulated reads and temporary bytes must not be interpreted as daily
usage. Aggregate pg_stat_statements by query ID across roles before taking deltas.

Confirmed expensive paths:

- Model-history charts repeatedly fetch scattered rows from the 475 MB snapshot
  table, although they need only the date and four small numeric columns.
- Recent job-log queries scanned roughly 38,000 irrelevant historical rows.
- Provider news used a global publication-date index and filtered over 10,000
  candidates to return 12 rows.
- Benchmark coverage downloaded approximately 65 pages of news per audit,
  including empty link arrays, repeatedly scanning earlier OFFSET pages.
- Homepage/ranking-health catalogue fetches also reread earlier OFFSET pages.
- Prepared catalogue ranking queries could not use the partial active-model
  ranking index and sorted wide rows with only approximately 2 MiB work_mem.

## Production Database Changes

Migration 100 was applied statement by statement through the Supabase Management
API using concurrent DDL. Six indexes cover job-log time, chart fields, provider
news ordering, catalogue status/ID, catalogue status/rank, and nonempty news
links. The last index deliberately does not INCLUDE the UUID array: existing
arrays reach 31 KB and could violate the B-tree tuple limit.

The exact duplicate `idx_snapshots_model_date` was removed after verifying it
was not constraint-backed. The original `idx_model_snapshots_model_date`,
primary key, and unique model/date constraint are retained. No user, model,
news, or historical snapshot rows were deleted.

Migration 101 adds an invoker-security scalar-array summary RPC. Function
creation and privilege changes were applied atomically. It has an empty search
path, explicitly references the public table, and permits execution only by
service_role and its owner. No RLS policy or public table grants were changed.

The production database changes are independent of an application deployment.
They do not apply the reserved billing migration 099 or enable Stripe charges.

## Application Change

All five benchmark-news coverage consumers use the same summary helper rather
than downloading every matching news row. Concurrent reads on the same client
share an in-flight promise; completed or failed results are not retained across
runs. Different clients never share results. Missing RPCs and malformed data
fail visibly rather than returning false coverage or silently resuming expensive
full scans.

Homepage/ranking-health catalogue traversal uses a unique ascending UUID cursor
instead of growing offsets. It still visits the full active catalogue, handles
exact page-size boundaries, rejects non-advancing cursors, and propagates errors
instead of publishing partial results. As before, this is not a transactional
snapshot of concurrent ingestion; new rows can appear on the next refresh.

Application changes require normal code-owner review and deployment. Database
optimizations are already active, but deployed agents do not use the new RPC
until the application change is released.

## Verification

Representative live EXPLAIN ANALYZE results, with concurrent workload and cache
effects rather than a controlled benchmark:

| Read | Before | After | Buffer accesses before / after |
| --- | ---: | ---: | ---: |
| Recent cron logs | 1517 ms | 249 ms | 2514 / 477 |
| Model chart | 37 ms | 4 ms | 24 / 7 |
| Provider news | 3056 ms | 10 ms | 12524 / 166 |
| Catalogue page after 8000 rows | 49 ms | 29 ms | 10793 / 1007 |

The chart now uses an index-only scan (two heap visibility fetches in the sample).
The catalogue keyset query uses the status/ID index and visits only its page.
The prepared ranking plan now uses the status/rank index with no Sort node.
The summary RPC returns all 3476 evidence model IDs in one response, including
IDs beyond PostgREST's 1000-row default. SQL comparison against the legacy
DISTINCT/unnest result returned exact equality. A live service-role REST call
succeeded; a public-key call returned 401/42501. Privilege checks also denied
execution to authenticated. The RPC is for server-side audits, not a new public
data endpoint.

Unit, component, lint, and typecheck results are recorded in the pull request.
Production homepage, listing, a model detail page, pricing, and the health
endpoint returned HTTP 200. One cold listing request took 18 seconds before the
prepared-ranking index addition; HTTP success alone is not a performance pass.

## Release And Follow-Up

1. Do not run migration 100 inside a transaction or a migration runner that
   wraps the file. Run each statement separately with CONCURRENTLY intact.
2. Check pg_index.indisvalid and indisready after every online build. If a build
   fails, inspect progress and invalid indexes before retrying; IF NOT EXISTS
   alone does not repair an invalid index. Do not drop a valid original index
   until its replacement has been checked.
3. Apply migration 101 atomically before releasing the application. Both files
   are retryable after successfully verifying the existing indexes and RPC.
4. Use the normal review and CI gates. No previous one-time admin-merge approval
   applies to this change, and no protected-branch bypass was used.
5. After release, compare rates over equal windows, verify agents/source
   freshness, and check Supabase's Disk IO budget graph after a normal cycle.
   Swap activity remained present during this session; warning clearance and
   sustained IO-budget recovery have not been verified. Consider compute memory
   separately only if pressure persists after the query rollout.

No VACUUM FULL, global work_mem increase, statistics reset, scheduler shutdown,
retention reduction, billing activation, or paid plan change was performed.
Rollback the application independently if necessary; the additive read-only RPC
and indexes are compatible with the old application. Restore the removed
duplicate only if evidence justifies it, not as an automatic rollback step.

References: [Supabase Disk IO](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io),
[index-only scans](https://www.postgresql.org/docs/17/indexes-index-only-scans.html),
[concurrent indexes](https://www.postgresql.org/docs/17/sql-createindex.html).
