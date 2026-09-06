# Data API Subscription Billing

## Status And Scope

Prepared on 2026-09-06, not activated. This sells monthly Data API access, not
model inference, GPU capacity, marketplace purchases or wallet deposits. Live
charging remains off until the gates below pass. Existing administrator-approved
pilots continue unchanged. No live Stripe catalogue, customer, subscription,
charge, refund or merchant-wide setting was created by this implementation.

The owner added a restricted live key to this application's Railway service and
enabled Accounts Read. A read-only check returned HTTP 200, matched the existing
merchant pin, and reported charges enabled. This does not verify all required
permissions, prove a completed payment, or audit other businesses on the account.

## Isolation And State

- Only the authenticated user ID selects a billing customer. Each app-created
  customer/subscription carries `app=aimarketcap`, `purpose=data_subscription`
  and `user_id`; customers are never matched or reused by email.
- The restricted credential and merchant pin are server-only. Restricted keys
  constrain resource permissions, not individual objects or metadata. This is
  application-level separation, not a separate Stripe account or a guarantee
  against compromise. Do not expose keys, raw provider errors or customer objects.
- The database separately pins merchant and live/test mode. New tables are RLS
  protected and only `service_role` may execute billing RPCs. Never use test
  subscriptions against the production database.
- Checkout attempts and customer creation use stable idempotency identifiers.
  Per-user database leases fence concurrent/stale writes. Unknown Checkout
  results older than 23 hours require support review, not blind retries.
- Signed webhooks re-fetch canonical subscription state. Only a paid invoice and
  valid active, approved-price subscription grant paid access. A return URL,
  trial, failed payment or incomplete checkout cannot grant it. Event projection
  and replay auditing are atomic; old contracts cannot replace later purchases.
- Refund/dispute events place a persistent access hold, requiring support review.
  The app does not issue refunds or auto-release holds. Reconciliation refreshes
  subscriptions; it does not backfill missed historical refund/dispute events.
- Banned users cannot purchase, but authenticated owners retain billing management
  for cancellation, including when new sales are disabled or email is changing.
- Account deletion is fenced before any data deletion. Any linked billing
  customer, pending checkout or live lease blocks deletion. Support must reconcile
  even canceled customers before completing deletion; do not remove mappings or
  delete auth users directly while contracts or unknown attempts remain.
- Active manual/promotion grants cannot be silently replaced by paid checkout.
  Database guards also stop admin grants from overwriting linked Stripe contracts.

## Configuration

Preserve existing wallet configuration. In the AIMC service only, configure:

| Variable | Requirement |
| --- | --- |
| `STRIPE_SECRET_KEY` | Dedicated `rk_live_` for production; isolated test credential for staging |
| `STRIPE_EXPECTED_ACCOUNT_ID` | Reviewed merchant, also pinned in the billing settings table |
| `DATA_API_BILLING_MODE` | `live` in production, `test` only with a separate staging database |
| `STRIPE_DATA_PRO_PRICE_ID` | Approved, active monthly USD recurring Pro price |
| `STRIPE_DATA_BUSINESS_PRICE_ID` | Different approved monthly USD recurring Business price |
| `STRIPE_DATA_PORTAL_CONFIGURATION_ID` | Dedicated, active AIMC portal configuration |
| `STRIPE_DATA_WEBHOOK_SECRET` | Secret for the dedicated data subscription endpoint |
| `DATA_API_BILLING_ENABLED` | Default `false`; enables new subscription checkout only |
| `DATA_API_BILLING_RECONCILE_ENABLED` | Default `false`; independently enables reconciliation |
| `NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED` | Keep `false`; wallet funding is a separate launch decision |

Pro/Business price amounts must match `data_api_plans.monthly_price_cents` and
their expanded products must carry `app=aimarketcap`, `purpose=data_subscription`.
Plans must be public, active and individually `checkout_enabled`. Static pricing
currently proposes USD 49/199 monthly; confirm pricing, data rights, recurring
terms, tax handling and actual deliverables before creating live prices.

Create a dedicated portal configuration, not a change to the shared default.
Tag it `app=aimarketcap`, `purpose=data_subscription`; enable cancellation at
period end, invoice history and payment-method updates. Disable subscription
updates, hosted portal login and immediate/prorated cancellation. Use AIMC
terms/privacy/return URLs without changing merchant-wide branding or bank details.
See [Stripe portal configuration](https://docs.stripe.com/api/customer_portal/configurations/create).

### Least-Privilege Permissions

Runtime API usage requires Accounts Read, Customers Write, Checkout Sessions
Write, Subscriptions Read, Prices Read, Products Read, Invoices/Invoice Payments
Read, Charges Read, and Customer Portal Write (including configuration reads).
Verify these in a sandbox with the actual pinned API version; use permission
errors/request logs to identify any additional implied permission, rather than
granting blanket write access. Product/price/webhook creation is operator setup,
not a reason for permanent catalogue or webhook write permissions. No payout,
transfer, bank account or refund write permissions are used by this code.
See [Stripe restricted keys](https://docs.stripe.com/keys/restricted-api-keys).

### Dedicated Webhook

Use `https://aimarketcap.tech/api/webhooks/stripe/data-access` and API version
`2026-02-25.clover`. Do not replace `/api/webhooks/stripe`, which handles wallet
settlements. Subscribe to:

- `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.subscription.paused`,
  `customer.subscription.resumed`.
- `invoice.paid`, `invoice.payment_failed`.
- `charge.refunded`, `charge.dispute.created`.

Canonical snapshots use item-level billing periods and expanded latest invoices.
Modern refund linkage uses the PaymentIntent filter on the
[invoice-payments API](https://docs.stripe.com/api/invoice-payment/list), with
legacy invoice linkage accepted. Use a separate signing secret and prove event
delivery/signature verification against this version in staging.

## Release Gates

1. Complete the existing code-owner review, but do not merge yet: merging `main`
   triggers Railway deployment. Complete staging verification and the production
   migration below first. Previous one-time admin merge approval for PRs #36/#37
   does not authorize bypass on this work.
2. Apply migration `099_add_data_api_stripe_billing.sql` to isolated staging first.
   Test genuine Stripe sandbox Checkout, payment, renewal, authentication-required
   payment, declined payment, cancellation, refunds/disputes, delayed/duplicate
   events and concurrent retries. Prove API quota changes, not just UI status.
3. Verify customer-visible receipts/statement identity, deliverable freshness,
   pricing/data rights, recurring terms, tax handling and support/refund process.
   Restricted-key tests must pass with exactly the intended permissions.
4. Apply migration 099 to production **before deploying the routes**, with flags
   false and individual plan checkout disabled. Account deletion now requires its
   RPC and fails closed with HTTP 503 if the migration is absent. The migration
   itself defaults to live mode with an unset merchant pin, so billing is blocked.
5. After review, pin the correct production merchant in
   `data_api_billing_settings` with `livemode=true`, configure only dedicated live
   objects/secrets, merge the reviewed application for Railway deployment, and
   redeploy the existing Cloudflare cron Worker with updated shared config. Never
   point test mode at production.
6. Verify the authenticated `/api/cron/data-billing` route. Its configured schedule
   is `10-59/15 * * * *`: minutes 10, 25, 40 and 55. Work is bounded to 10 due
   customers and roughly 60 seconds per run; monitor backlog and lease failures.
7. Keep the webhook and configuration available after enabling new sales. Enable
   reconciliation and plan checkout deliberately, then the runtime sales flag only
   once all gates pass. Do not make a real customer charge as a smoke test.

For rollback, set `DATA_API_BILLING_ENABLED=false` to stop new sales without
disabling portal cancellation or settlement webhooks. Do not remove the signing
secret, merchant pin, price IDs, customer mappings or reconciliation for existing
subscribers. Do not drop the migration after customers exist. Escalate unresolved
events/holds to support; inspect only app-owned objects and minimal audit metadata.

## Verification And Known Limits

Run `npm run test:unit`, `npm run test:component`, `npm run test:data-billing-db`,
`npm run lint`, `npm run typecheck`, the fixture build and existing Playwright
suite. The database test runs actual migrations and RPCs in an ephemeral
network-disabled PostgreSQL 17 container with no published port. It covers RLS,
RPC grants, merchant/mode guards, lease fencing, replay safety, quota changes,
manual-grant conflicts, holds and deletion fencing.

Mock tests and local browser fixtures are not Stripe end-to-end evidence. Genuine
sandbox billing and production migration/deployment remain launch gates. Existing
API keys retain their explicitly stored per-key rate caps after a plan upgrade;
new keys use the new plan defaults. Monthly quotas reset by UTC calendar month,
not subscription anniversary. Self-serve plan switching/proration, automated
refund decisions, automated billing-customer deletion and historical dispute
backfill are not implemented. Monitor oldest `last_checked_at`, cron failures and
Stripe delivery failures; retain only necessary audit metadata under an agreed
retention policy.

This targeted implementation does not establish whole-site launch readiness:
complete authentication/admin authorization, dependency, production-secret,
abuse-control and data-rights reviews remain necessary. See
[Payment Activation Gates](PAYMENT_ACTIVATION_GATES.md).
