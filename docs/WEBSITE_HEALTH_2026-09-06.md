# Website Health Check: 2026-09-06

This is the initial, pre-rollout snapshot. PRs #33 and #30 were subsequently
deployed. See [the catalog efficiency follow-up](CATALOG_EFFICIENCY_2026-09-06.md)
for the later deployment state, measured bottlenecks and remaining blockers.

## Result

Production is online, but not fully healthy or verified for paid public launch.
The live app is Railway commit `478bc437` on `main` (deployed August 25).
No deployment, payment activation, real purchase, refund, or GPU launch was made
during this check. Local provider-page verification used public production model
data. Starting the local app also ran its existing adapter-registry startup seeder;
it was not a completely side-effect-free local startup.

## Confirmed Issues

- **Provider discovery is truncated.** The existing active-provider query returned
  only 1,000 of 11,451 active model rows and contained no Anthropic entry. A direct
  provider-filtered query returned current Anthropic records. Production
  `/providers/anthropic` rendered `Provider Not Found` despite those records.
  Both directory and detail queries had response-cap assumptions.
- **Terminal-Bench updates are failing.** Nine consecutive failures, last success
  August 28; the adapter reported no usable model rows. Its replacement is already
  in PR #30, not in production. Do not repeatedly run the broken adapter as a fix.
- **Open LLM Leaderboard is degraded.** One failed run with Hugging Face HTTP 429;
  last successful sync September 6 at 12:07 UTC. Other sources continued updating.
- **Not all metadata or benchmarks are complete.** Pipeline health reports 2,875
  of 11,451 active models with benchmark coverage (25.1%). One official
  benchmark-expected model lacks evidence/update locators. Official public-surface
  readiness is 93.6%, below its 95% target. Missing values must not be fabricated.
- **Pending work is not live.** `/workspace/pods` and its API return 404 because
  PR #31 is not deployed. PR #30 requires review; #31 and #32 are stacked on it.
  Subscription billing and paid entitlements are not implemented by merely
  configuring Stripe products or receipts.

## Working Checks

- Main public pages returned HTTP 200: home, models, providers directory,
  leaderboards, compare, discover, marketplace, Commons, deployment landing,
  pricing, API docs, contact, login, signup, and password-reset request page.
  A sampled Claude model-detail page also returned 200 with the expected title.
- Public models, search and Commons-feed API calls returned 200 with data shapes
  expected by their consumers. Invalid contact input returned 400 without creating
  a submission or sending email.
- Anonymous admin access redirected to login. The tested admin/users, account,
  provider-connections, subscription and wallet APIs rejected anonymous requests
  with 401. Logged-out Workspace navigation reached the login page.
- Mobile home and Commons layouts had no horizontal document overflow at 390px.
  Opening the mobile navigation and selecting Commons navigated successfully and
  closed the menu. This was an anonymous session, not a post-login regression test.
- Railway has one running application service and no additional Railway cron
  service in this project. Its deployment status is SUCCESS. Database health was
  connected with a sampled 180ms query latency; this does not measure Disk IO quota.
- Cloudflare's deployed dispatcher responds 200, targets `aimarketcap.tech`, knows
  19 jobs, and has a verified `*/5 * * * *` Cron Trigger. App health reports external
  scheduling, no stale jobs, and no failed cron runs in the preceding 24 hours.
  Adapter failures are separate from the enclosing cron-run completion status.
- Five resident agents are active with zero recorded error counts. Four ran on
  September 6; UX Monitor last ran August 31, consistent with its Monday schedule.
- OpenAI, Anthropic and Google source syncs succeeded around 18:02 UTC. Existing
  Claude 3 Opus and Claude 3.5 Haiku records were updated around 18:46 UTC. This
  confirms continued refreshes, not independent verification of every model claim.
- `/go/runpod` redirects to the approved referral URL. Attribution and actual
  provider payouts were not verified.
- Latest completed full CI on the Stripe branch passed; its earlier schema-check
  failure was followed by a successful rerun on the corrected commit.

## Provider Fix Prepared

The separate `fix/provider-directory-pagination` branch adds deterministic,
paginated public queries, provider filtering before fetching detail records, and
shared metadata/page lookups. Public pages are cached in bounded chunks for five
minutes; no authenticated/customer data uses this cache. Partial query failures
raise an error rather than falsely declaring a provider missing.

The directory now offers search and 60-card pagination rather than rendering more
than 1,200 cards at once. News candidates and provider groups use indexed lookups.
Provider top-rank summaries no longer assume family presentation order is rank
order, and the directory's top-model offer follows its best-ranked model.

Local checks recovered Anthropic and OpenAI pages, showed Anthropic in the
directory, and verified search and page two. Desktop and mobile browser inspection
of Anthropic showed content and no error overlay; no page errors were reported.
Cold local directory rendering still took about 21 seconds and warm filtered/page
requests about 9-10 seconds in development. Production latency and further
aggregation optimization remain follow-up work, not a claimed performance pass.

## Remaining Verification

The owner's signed-in Chrome endpoint was unavailable. Real login/OAuth completion,
authenticated Workspace scrolling, Commons posting, and admin workflows were not
verified. No real contact email, password-reset email, receipt delivery, card charge,
subscription lifecycle, wallet funding, provider inference, or GPU lifecycle was
tested. Supabase Disk IO budget, complete infrastructure billing, dependency risk,
and comprehensive authorization/abuse testing were not audited in this pass.

Do not call this a full public-launch security review or claim that all features
are working. Required reviews and deployment verification are still necessary.
