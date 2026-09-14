# Database IO Follow-Up: September 14, 2026

This follows deployed PRs 43 and 44 (`0e9e6ea`). It does not activate payments,
change agent schedules, delete catalogue/history records, resize paid compute,
or change global PostgreSQL planner/memory settings.

## Reproduced Issues

The actual anonymous prepared directory query still sorted wide candidate rows
and spilled after migration 102. An owner-role literal EXPLAIN was insufficient
verification. At offset 9,500, a fresh sample wrote 507 temporary blocks (about
4 MiB); narrowing the materialized page to IDs/ranks removed that spill.

The pipeline engineer (14:31 UTC) and UX monitor (10:00 UTC) also failed on the
benchmark evidence summary. The single RPC introduced in PR 43 removed network
pagination, but still scanned 15,163 linked benchmark news rows in a 130 MiB
table. One scan took 4.46 seconds; subsequent warm calls were much faster. The
first design reduced requests, not the underlying news-heap working set.

A separate production configuration drift was found while checking privileges:
`Service role can manage model_news` was actually `FOR ALL TO PUBLIC USING (true)`.
Anonymous and authenticated roles also held INSERT/UPDATE/DELETE grants. An
anonymous EXPLAIN of an UPDATE with a nonexistent ID confirmed an unrestricted
write plan without executing a mutation. This was a critical integrity risk;
there is no evidence from this investigation that it was exploited.

The same inventory found a public INSERT policy on app-owned `notifications`,
allowing forged system notifications. Migration 106 restricts that policy and
INSERT grants to the service role. Contact, moderation, verification and order
message handlers already use server/admin clients for notification creation.
Existing per-user SELECT/UPDATE policies are preserved and tested.

## Changes And Rollout

Migration 103 scopes that news policy to `service_role` and removes public/user
write, truncate, references, and trigger grants. Public reads remain available;
server-side ingestion and the existing authenticated admin endpoint use the
service role and retain their write access. Do not roll back this security fix.

Migration 104 stores only `(news_id, related_model_ids)` in the private
`benchmark_evidence_links` table. Insert/update triggers and cascading foreign
keys keep it transactionally synchronized, including reclassification, changed
links, NULL/empty arrays, source deletion, and rollback. Unchanged arrays do not
rewrite the projection. No model foreign key is added: evidence for an ID not
currently in the catalogue must retain the old summary semantics. Full arrays
are not placed in a B-tree index because some exceed the index tuple limit.

The summary retains its existing service-only RPC signature, sorted/distinct
UUID array result, invoker security, and empty search path. The trigger is a
non-public, fixed-query definer function; the service role can read but cannot
directly write the derived table. A short write lock plus two-second lock timeout
protects backfill/trigger consistency. Apply this migration atomically; a failed
lock acquisition should be retried later, not left queued indefinitely.

Migration 105 adds an invoker-only public ranked-directory RPC. A materialized
ID/rank page is selected before fetching the 28 public candidate fields. It
returns at most 500 rows, accepts only page offsets 0..9,500 in steps of 500, and
counts the complete RLS-visible active catalogue only on the first page. The
application uses it only for the default active/rank filter combination. Price,
search, category, provider, parameter, license, and lifecycle queries retain
their established behavior. Existing 10,000-candidate limits, concurrency of two,
five-minute caching, anonymous-client isolation, and failure propagation remain.
Optional filter/sort query plans have not all been optimized by this change.

All three database migrations were applied directly, independently of application
deployment. Migration 104 validated exact summary-array equality and linked-news
row count before commit: 15,163 linked rows and all 3,514 unique model IDs matched.
The projection including indexes/TOAST occupied 1,888 KiB. A service-role summary
sample used 532 shared-buffer hits, versus 15,866 before, with zero temp IO. This
is fewer logical buffer accesses, not a measured claim of sustained IO-budget
recovery or a controlled latency benchmark.

The final directory RPC, tested as anonymous with forced generic plans, wrote
zero temporary blocks at offset 9,500. That first sample still took 1.36 seconds;
memory pressure/cold execution and application rendering need monitoring. Do not
equate the no-spill result with a complete end-to-end performance fix.

The application change needs its own reviewed release. Earlier one-time admin
merge grants for PRs 43 and 44 do not authorize bypassing this new review gate.

## Verification And Limits

`bash scripts/test-database-io.sh` runs isolated PostgreSQL 17 with no published
ports, network access, or production credentials. CI also runs it. Checks cover
backfill above 1,000 UUIDs, duplicates/NULLs, changed/unchanged links, category
changes, cascades, transaction rollback, private grants, all 20 directory pages,
rank ties/NULLs, full counts, RLS filtering, malformed offsets, empty results,
and an extra private fixture column that must never appear in public output.

Application tests cover cache sharing, every optional filter avoiding the
default-only RPC, pagination/caps/concurrency, malformed RPC responses, failed
pages, and complete deployment availability. The focused suite (33 tests), full
unit suite (1,888 tests), component suite (362 tests), typecheck, and lint passed.

Live HTTP checks confirmed public news SELECT succeeds, an impossible-match
anonymous news PATCH is rejected with 401/42501, anonymous access to the summary
is rejected, and the service summary returns all 3,514 IDs. The ranked RPC
returns 500 candidates and the full 14,894 active-record count on page one.
All 20 live RPC pages matched the original anonymous ranked query: 10,000 IDs
in identical order, no duplicates, with the largest observed page under 470 KiB.
The previously failed UX monitor completed a real production run in 19 seconds;
the pipeline engineer completed in 44 seconds. Neither was skipped and both
reported no execution errors. Health at 15:15 UTC was healthy with 37 healthy
sources, zero degraded/down sources, and a fresh external scheduler. Historical
failures remain in the 24-hour counter; their records were not erased.
Browser checks confirmed 20 results on desktop and deployable page-two grid,
page two selected, and no browser errors/overlay or horizontal overflow at 390px.

This is not a public-launch security certification. A limited policy inventory
also found broadly scoped service-labelled write policies on tables not defined
by this application's migrations. Establish ownership and audit those separately
before making project-wide security claims. Auth/account flows, dependency risk,
other APIs, historical data integrity, and potential past abuse were not fully
audited here. The accessible metrics do not expose the Supabase IO-budget graph;
warning clearance and sustained memory/IO recovery remain unverified.

Rollback: retain security migrations 103 and 106. An application rollback can leave migration 105
installed. If the projection needs rollback, atomically restore the migration 101
summary function and drop only the two new synchronization triggers; keep news
records and the derived table intact for investigation. Restoring the old summary
also restores its higher IO cost. Do not reapply all historical migrations or
the reserved billing migration 099.

References: [PostgreSQL trigger semantics](https://www.postgresql.org/docs/17/sql-createtrigger.html),
[function security](https://www.postgresql.org/docs/17/sql-createfunction.html), and
[materialized CTE behavior](https://www.postgresql.org/docs/17/queries-with.html).
