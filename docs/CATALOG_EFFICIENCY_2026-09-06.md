# Catalog Efficiency Follow-Up: 2026-09-06

## Scope and deployment state

This continues the website check after PRs #33 and #30 were merged and verified
on Railway at commit `32d9725fa7c8e1377b2991e485257875d1fd12b3`.
Their previously recorded one-time merge authorization is complete. This new
branch requires normal review; no new protection override is authorized.
PRs #31/#32, Stripe activation and paid GPU launches are outside this change.

Infrastructure checks in this follow-up were read-only. No database migration,
compute upgrade, production variable change or forced production sync was made.
Local application checks used public production data with startup seeding and
in-process cron disabled and no service-role key available to the local app.

## Prepared fixes

- Cache serializable, public provider summaries for 300 seconds across searches
  and pagination. Do not cache auth state, request cookies or search input.
  Remove redundant inner raw-page caching so it does not compound staleness.
  Failed queries do not cache a misleading partial directory.
- Pre-index canonical provider names and provider news rather than repeatedly
  scanning all brands/news for each model/provider. Unknown names retain their
  presentation; inherited object properties are not mistaken for provider brands.
- Count all represented models, open weights and downloads in the directory's
  global counters, including providers whose single-model cards are filtered out.
  Previously the visible Total Models count could be below Deployable Models.
- Cache the public model-detail history query per model for 300 seconds. This is
  the exact query shape with the largest cumulative shared-block reads in the
  production `pg_stat_statements` sample. Query failures are not cached as empty
  history. Paid API responses and user-specific access decisions are not cached.

These are application caches with revalidation, not a guarantee of a strict
maximum data age during upstream failures. Page-level CDN privacy is unchanged.

## Measurements and verification

- Before this change, production `/providers?q=Anthropic` took 9,993 ms and
  4,398 ms in two HTTP samples. The first byte arrived much earlier than completion.
- Local real-data profiling measured provider-news matching at 5,574 ms before
  indexing and 3 ms after. Catalog/family deduplication remained about 3 seconds
  after canonical-name indexing. These are isolated samples, not a benchmark SLO;
  the autonomous catalog grew between samples.
- Local development warm search samples after summary caching: 168-262 ms for
  Anthropic/OpenAI. Cold directory generation still took about 15-17 seconds.
  Production latency and bill reduction require post-deployment measurement.
- The model-detail page returned HTTP 200 on both cold and warm requests after
  the history-cache change. Other uncached model-detail queries remain.
- Browser checks at 390px verified directory content, corrected counters and
  actual Anthropic-to-OpenAI search submission, without horizontal overflow.
  The 1440px desktop directory also rendered without horizontal overflow.
  The checked browser console contained development logs, not application errors.
- Final unit suite: 290 files, 1,722 tests passed. Component suite: 150 files,
  342 tests passed. Lint, typecheck and diff whitespace checks passed.
- Production build completed with exit code 0. The real-data build logged
  static-generation fetch warnings while local DNS resolution was failing.
  A second build using E2E environment variables also completed; its prerender
  logged dummy-JWT warnings. These are not claimed as clean live-data builds.
  All six existing model-detail E2E tests passed against the built server on
  Chromium desktop and mobile, including tab and leaderboard navigation.
- GitHub and public-site DNS resolution became unreliable late in verification.
  A per-command Git HTTPS DNS override, resolved through public DNS, restored
  repository connectivity without changing persistent network configuration.

## Supabase IO findings

The project was ACTIVE_HEALTHY. Its gp3 disk configuration was 8 GB, 3,000 IOPS
and 125 MiB/s. The exposed filesystem used 1,295,261,696 of 8,350,298,112 bytes
(about 15.5%). This is disk space, not the remaining daily Disk IO budget.

The exposed memory metrics showed about 411 MiB total, 104 MiB available, and
56% of the 1 GiB swap allocation in use. Over a roughly 64-second sample, the
system/swap device read 4.62 MiB/s and wrote 1.95 MiB/s; the Postgres-data device
read 0.31 MiB/s and wrote 0.33 MiB/s. This suggests memory/swap pressure warrants
attention, but it does not prove the daily budget was exhausted at that moment.

`model_snapshots` occupied about 382 MB with roughly 372,205 live rows. The
model-detail history query accounted for about 8.54 million shared-block reads
in the cumulative query-statistics sample. News reads were also prominent.
Those counters are cumulative, not traffic or usage over the last hour/day.

The exact remaining daily IO budget was not obtained. Do not declare the warning
resolved, delete history, run disruptive maintenance or upgrade billing based only
on these samples. After deployment, compare query-rate deltas, disk IO and swap
with the dashboard's budget graph before considering indexing or compute changes.
Supabase distinguishes [IO budget exhaustion](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)
from [memory/swap pressure](https://supabase.com/docs/guides/troubleshooting/memory-and-swap-usage-explained-aPNgm0).

## Remaining operational blockers

### Open LLM Leaderboard

The current adapter scans all 4,576 dataset rows (46 requests) before choosing its
top 500. An experiment using Hugging Face's documented
[/filter sorting](https://huggingface.co/docs/dataset-viewer/filter) would reduce
that to five requests. A two-row probe succeeded, but repeated 100-row probes
returned HTTP 500 `ResponseNotReady` with an unavailable/loading dataset index.
The experiment was removed rather than shipping an unverified replacement.
The existing production rate-limit warning therefore remains unresolved.

The public [dataset API](https://huggingface.co/api/datasets/open-llm-leaderboard/contents)
reported `lastModified: 2025-03-20T12:17:27.000Z` at revision
`9c09a7cae43334062a82cb164f2ef255013dafa2`. This source cannot establish coverage
of new 2026 models. Existing scores should remain historical evidence, not be
represented as newly evaluated merely because an ingestion job reran. Replacing
the source requires provenance/coverage checks, not invented benchmark scores.

### Email delivery

Read-only production configuration checks found no `RESEND_API_KEY`. The contact
route saves submissions and admin notifications, but its email helper skips
delivery when this key is absent. Contact sender/recipient overrides are also
absent; the application has support-address defaults. This requires a working,
verified Resend sender and production key, or a separately tested SMTP adapter.

Supabase Auth already has configured SMTP credentials on an MXroute host using
port 465. Login/confirmation emails and application contact notifications are
separate paths; configuring one does not configure the other. No credentials,
customer message bodies or payment details were written into this report. No
real email delivery was tested or provider configuration changed.

### Launch verification

The owner's Chrome debugging endpoint at port 9222 was unavailable. Authenticated
Commons, admin and Workspace flows remain unverified in this follow-up, as do
real email delivery, payment/subscription lifecycle and GPU provisioning.
This was not a comprehensive authentication, authorization, dependency or abuse
audit. The platform is not yet verified for a paid public launch.
