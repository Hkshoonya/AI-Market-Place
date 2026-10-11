# Recurring Disk IO Warning: October 11, 2026

## Findings

Production still runs `0e9e6ea`. PR #45 remains open with required review missing;
the ranked directory caller has not reached production. Prior PR #43/#44 admin
merge approvals were one-time and cannot be reused. No manual release bypass.

The nightly `maintenance-retention` run failed at 01:41 UTC while selecting
`highFrequencyNewsDeleted`: statement timeout. The service-role forced-generic
plan for its 645-ID batch walked `idx_model_news_published`, discarded 10,669
unrelated rows, and used 9,289 shared hits plus 1,669 reads. Execution took
6,250 ms. No deletion was invoked during this investigation.
The last 14 days contain 11 completed retention runs and three failed runs;
the latest successful run was October 10. This is intermittent, not evidence
that cleanup has been entirely disabled.

Authenticated `/api/health` incorrectly reported zero failures: it retrieved
only the newest 100 cron runs while claiming a 24-hour window. The nightly
failure was older than those 100 runs. At verification the complete window
contained 500 runs and one unresolved failed job.

Storage is not full: about 2.02 GB of 8.35 GB used at 17:50 UTC. Database objects
occupy about 1.46 GB, including 1.10 GB of model snapshots and their indexes.
Host RAM is 431,304,704 bytes (411 MiB). Between 17:50:11 and 17:58:38 UTC,
swap-in increased by 168,323 pages and swap-out by 184,694 pages. System/swap
device reads/writes rose by 1.92 GB/764 MB; data-device reads/writes rose by
133 MB/74 MB. This is active memory pressure, not merely occupied idle swap.
Metrics do not expose the remaining burst IO budget; warning clearance cannot
be inferred from filesystem space or a healthy HTTP response.

## Changes And Rollout

Migration 107 adds a concurrent `(published_at, source) INCLUDE (id)` news index.
It supports ordered retention selection without fetching unrelated heap rows.
Applied live, valid/ready, 5,627,904 bytes. Afterward the same service-role forced
generic query used an index-only scan, 89 shared hits, zero heap fetches, zero
temp blocks, and 3.27 ms execution. Cache conditions differ: the timing is an
observation, not a controlled speedup or proof of sustained budget recovery.
The real PostgREST SELECT also succeeded: HTTP 200, 645 IDs, 2.11 seconds
including network/API overhead. The cleanup job itself was not manually run.

Migration 108 adds `get_cron_health_summary()`: fixed 24-hour aggregation,
scalar JSON to avoid API row caps, deterministic latest-status selection,
existing auto-stale exclusion from historical failure counts, empty search
path, SECURITY INVOKER, executable only by service_role. Applied live; service
HTTP call succeeded, anon HTTP call returned 401/42501, authenticated EXECUTE
privilege is false. This is additive and does not change public health output.

The health caller now uses that RPC and rejects errors or malformed summaries
instead of reporting healthy. This application change awaits PR #45 release,
alongside the directory fix. Apply 108 before deploying the caller. Do not
reapply all migrations or reserved billing migration 099. An application
rollback can leave 107/108 installed; do not drop the RPC while its caller is live.
Concurrent index retries must first check validity: IF NOT EXISTS does not
repair an interrupted invalid build. Existing indexes have not been removed.

## Verification And Limits

Focused health tests: 25 passed. Isolated PostgreSQL 17 regression checks passed,
including 1,200 newer successful runs hiding an older failure, newer successful
reruns, auto-stale rows, old-window exclusion, equal timestamps, empty results,
service access and anonymous/authenticated denial. All 1,894 unit tests,
typecheck and lint passed.
The first full unit run exposed two pre-existing date-sensitive fee-label tests:
their implicit current date had passed the six-month waiver window. Test inputs
now specify the launch date and also cover a post-waiver date; payment code,
fee constants, and activation settings are unchanged.

No retention periods, schedules, paid compute, global planner/memory settings,
Stripe configuration, or model/user/history records were changed. The next
scheduled retention run, deployed health behavior, sustained IO recovery and
the vendor warning remain to be verified. This is not a launch/security audit.

References: [Supabase Disk IO troubleshooting](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)
and [memory/swap guidance](https://supabase.com/docs/guides/troubleshooting/memory-and-swap-usage-explained-aPNgm0).
