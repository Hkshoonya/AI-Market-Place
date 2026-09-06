# Revenue Operations

## Current Offers

- Explorer: free evaluation key, 2,500 requests/month and 30 requests/minute.
- Data Pro: proposed $49/month, 100,000 requests/month and 300 requests/minute.
- Data Business: proposed $199/month, 1,000,000 requests/month and 1,000 requests/minute.
- Provider referrals: only an approved, active referral URL can attribute commissions.
- Sponsorships: enquiries only; agree placement, price, disclosure and delivery before accepting payment. Sponsorship cannot alter rankings.

Paid plans currently require an administrator to grant access after agreeing a pilot.
There is no automatic subscription checkout or automatic renewal. Existing Stripe
integration funds wallets; it does not bill Data API subscriptions. Do not enable
wallet payments as a substitute for a subscription billing integration.

## Customer Path

1. `/pricing` leads to a free API key or a plan-specific contact enquiry.
2. `/settings/api-keys` exposes usage and an upgrade enquiry link.
3. `/api/models?view=catalog` provides paginated active catalog records, including
   older models and variants, using a read/data-scoped API key. Follow `totalPages`.
   Missing scores remain null. The default public view remains curated.
4. The contact submission is persisted before email delivery is attempted.
5. `/admin/monetization` shows new, in-progress, replied and archived commercial
   enquiries. Opening an email draft or changing status does not send a message.

History is limited by both the plan and actual recorded coverage. Upstream data
licensing and redistribution rights must be reviewed before agreeing commercial
data delivery. Do not promise complete benchmarks, an SLA, or a year's history
for models whose evidence has not been collected for that long.

## Daily Automation

The existing `affiliate-maintainer` cron also checks revenue operations. No extra
Railway service or cron is required. It records persistent admin agent issues for:

- No active, in-date affiliate links.
- Commercial enquiries unanswered for more than 48 hours.
- Non-Stripe paid-tier pilot grants expiring within seven days.

The agent does not contact leads, renew grants, enroll in partner programs, invent
referral codes, or count grants/clicks as collected revenue. Database failures
fail the monitoring task rather than displaying reassuring zero counts.

## Activation Prerequisites

Confirm the Stripe account's AI Market Cap business identity, receipts and statement
descriptor before enabling any live charging. Subscription billing still needs
checkout, webhook-based entitlements, cancellation, refunds and renewal tests.

For referrals, obtain your unique link from the provider and activate it in the
admin panel. Start with the [official Runpod program](https://docs.runpod.io/accounts-billing/referrals).
Check current eligibility and reward type: credits are not cash revenue. The
maintainer verifies link availability, not attribution or payout eligibility.

## Operational Notes

Cloudflare Rocket Loader was disabled on 2026-09-06 after browser script-loading
warnings; Next.js controls its own script loading. Cloudflare analytics beacon
availability is independent of application health.

Provider benchmark jobs reserve 20% of their automatic-page budget for recent
releases and rotate the remainder by a persisted cursor in `sync_jobs.metadata`.
Terminal-Bench 2.0 is read from the official Harbor feed. Versions 2.1, 3.0 and
4.0 retain separate benchmark identities when extracted from provider sources.
