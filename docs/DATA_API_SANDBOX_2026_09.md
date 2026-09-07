# Data API Sandbox Verification, 2026-09-07

## Scope

An operator-led integration run exercised the actual application routes, local
GoTrue authentication, PostgREST and PostgreSQL 17, and genuine Stripe test-mode
Checkout, Portal, subscriptions, invoices and signed CLI-forwarded webhooks.
Billing migrations 087, 090 and 099 were applied unchanged to the isolated
database. Supporting profile/catalog tables were minimal fixtures, not a copy
of production data. MSW was disabled. API version: `2026-02-25.clover`;
Stripe CLI: `1.50.10`. Run reference: `aimc-billing-1788761260024`.

Only new, application-tagged test customers and test products were used. No live
charge, refund, subscription, production database write, migration, deployment,
wallet activation, shared merchant setting or bank setting was performed.
This does not constitute a whole-account or whole-site security audit.

## Observed Results

| Test | Actual result |
| --- | --- |
| Declined hosted Checkout | Stripe displayed a decline; access stayed Free |
| Successful hosted Checkout | Paid invoice and active subscription; actual catalog API quota changed from 2,500 to 100,000 |
| Authentication-required payment | Hosted 3D Secure test challenge; access stayed Free before completion, then Pro with 100,000 quota |
| Renewal | Stripe test clock generated a new paid cycle invoice and advanced the billing period |
| Failed renewal | Declining payment method produced `past_due`; paid access was revoked |
| Payment recovery | Paying the failed invoice with the success test method restored Pro |
| Portal cancellation | Hosted portal scheduled cancellation at the item period end; Pro remained available before that time |
| Cancellation completion | Advancing the clock past cancellation produced `canceled` and the 2,500-request Free quota |
| Old paid-invoice replay | Could not restore access to the canceled contract |
| Refund | Genuine test refund resolved through Invoice Payments and applied a persistent hold; Free quota enforced |
| Dispute | Genuine test dispute event applied a persistent hold; Free quota enforced; test dispute closed as lost |
| Duplicate/concurrent Checkout | Active subscriber rejected with 409; two simultaneous new requests produced one 200 and one 409; retry reused the same session |
| Webhook verification | Invalid signature rejected with 400; duplicate event had one audit row; live/test mismatch ignored |
| Auth and ownership | Anonymous checkout 401, foreign Origin 403, injected owner field 400; another user could not manage the primary customer's portal |
| Database permissions | Anonymous and other-user tokens could not read billing-customer mappings |
| Ban/deletion guards | Ban prevented purchase but not owner billing management; account deletion returned 409 and preserved the profile |
| Reconciliation | Missing cron credentials rejected with 401; authorized runs completed with zero failures and preserved the refund hold |

The dispute subscription was created through the Stripe test API with the
application's own checkout-attempt metadata. It was not a third hosted-Checkout
completion. Duplicate/stale event tests retrieved real test events and re-signed
them locally with the CLI test secret; they were not Dashboard redeliveries.
Normal payment/renewal/refund/dispute/cancellation events were genuinely generated
by Stripe and forwarded by the CLI. Concurrent deliveries can return retryable
409 lease conflicts; replay checks explicitly retry these.

The actual portal returned `cancel_at` equal to the item period end while
`cancel_at_period_end` was false. Checking the boolean alone caused an initial
test timeout, not a cancellation failure. Verification now checks the scheduled
timestamp and resulting cancellation; a regression test covers the response
shape. Entitlement projection already uses canonical status and item periods.

The browser billing page hydrated and displayed the actual Pro quota. The local
development proxy initially lacked WebSocket forwarding, which stalled hydration;
that harness defect was fixed. An overly frequent manual status probe also hit
the expected rate limit; normal UI polling is bounded to four 15-second retries.
These are not evidence that every production browser console is clean.

## Evidence And Remaining Gates

The operator toolkit is in `scripts/billing-sandbox/`. Raw local artifacts and
state under ignored `output/` are private and must not be committed or shared:
they include synthetic auth sessions and test secrets. Test objects are cleaned
up by ownership-checked cancellation/deletion and catalogue/portal archival.
This run is not a fully unattended or CI-hosted Stripe test suite.

Cleanup completed for the payment run. A second fresh initialization verified
the corrected Auth/database bootstrap from empty containers; its unused test
catalogue and portal were also archived. The sandbox browser, listener, app,
three containers and private network were stopped/removed. Other local projects'
containers were left running. The targeted billing suite passed 69 tests, and
the real PostgreSQL migration/RPC test, repository typecheck and lint passed.

The available credential was a standard `sk_test_`, not the intended restricted
test credential. Therefore the exact least-privilege production permissions are
still unverified. No real bank-card statement, production receipt identity, tax
configuration, recurring terms, data rights, production webhook delivery or
production deployment was verified by this run. Those gates remain in
[the billing runbook](DATA_API_BILLING.md). Migration 099 must precede application
deployment because the account-deletion route requires its guard RPC. Required
code-owner review still applies; this test run does not authorize a bypass.

Primary references: [Stripe test cards and tokens](https://docs.stripe.com/testing),
[test clocks](https://docs.stripe.com/billing/testing/test-clocks),
[subscription cancellation](https://docs.stripe.com/billing/subscriptions/cancel),
and [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys).
