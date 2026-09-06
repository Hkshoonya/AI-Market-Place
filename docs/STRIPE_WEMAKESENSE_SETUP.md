# Stripe Setup for AI Market Cap

## Account inspection, 2026-09-06

The local test key and Railway production live key both resolve to the same US
Stripe account: `acct_1SxKRxAneuEOaTi3`. Stripe reports company/display name
`wemakesense`, public website `wemakesense.co`, statement descriptor
`WEMAKESENSE`, and charges/payouts enabled. The API's public support email field
is null; the signed-in dashboard later confirmed an effective reply address of
`sense@wemakesense.co`. Do not infer missing customer support from that API field alone.
These API fields do not establish that every business-verification requirement,
tax obligation or product policy is satisfied.

The live account already has other products, including GreenBook. Do not rename
the shared merchant, change payout settings, or modify another product's prices,
portal, subscriptions or webhook destinations for AI Market Cap.

Railway has a live secret key, live publishable key, and webhook signing secret.
`NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED` remains `false`. A live destination already
exists at `https://aimarketcap.tech/api/webhooks/stripe`; the local test
environment initially had no products or webhook destinations. Test credentials
must never replace Railway's live credentials or be connected to its wallet ledger.
The expected merchant account ID was added to Railway with `--skip-deploys`;
payment flags and existing secrets were left unchanged. Recent production webhook
records were acknowledged as ignored for other products, and the audit query
found zero processed test-mode events. Audit history alone cannot prove that no
historical accounting error has ever occurred.

## Signed-in dashboard verification, 2026-09-06

With the owner's explicit Chrome remote-debugging authorization, the Kshoonya
profile was connected and the account was inspected directly:

- Account status: no active tasks to complete; Payments and Payouts active.
- Cartes Bancaires payments is paused. This is distinct from the active general
  Payments capability; no unrelated payment method was enabled during this check.
- Stripe warns that legal identity information is shared with other accounts.
  Legal/address changes can affect those accounts and were not made.
- Customer emails: Successful payments OFF; Refunds OFF; effective reply address
  `sense@wemakesense.co`. These are account-wide settings. The owner subsequently
  approved enabling both, including for other products. A follow-up Chrome
  connection was refused, so neither setting has been changed by this setup.
  Reconnect with the owner's browser authorization, enable only these two
  switches, and verify their persisted state before marking this step complete.
- Shared branding uses default colors. No AIMC logo or colors were applied to
  account-wide branding because that would affect other products.
- Both AIMC products and the USD 49/199 monthly prices were confirmed in this
  account's **Test mode** catalogue. They are not live products and are separate
  from the other sandbox listed in the account switcher.

No representative details, identity documents, tax identifiers, or banking
details are retained in these project notes. No legal or compliance declaration
was submitted. An empty account-task list is not a public-launch security review.

## Focused credential-exposure check, 2026-09-06

- Scanned 1,600 currently tracked files for exact matches to the available local
  Stripe, Supabase service-role, Railway and GitHub credentials, and for full-length
  Stripe secret/restricted-key and webhook-secret patterns. No matches were found.
  Credential values were not printed or included in the report.
- `.env.local`, `.playwright-cli/` and `output/playwright/` are ignored by Git;
  only the example environment files are tracked.
- Fetched public `/`, `/pricing`, `/wallet` HTML and their 29 directly referenced
  same-origin JavaScript assets. All returned HTTP 200, with no checked credential
  matches or Stripe secret-key patterns found. No customer records were queried.
- All 49 targeted wallet Checkout, Stripe webhook and configuration tests passed
  on the working branch. Those branch safeguards are not yet deployed.

Scope excludes full Git history, every dynamically loaded browser chunk, complete
production logs, Stripe team/MFA settings, and a review of every credential's
permissions. No unrestricted live key was rotated or revoked: that could interrupt
the merchant's other services. Use a dedicated least-privilege integration key
before paid launch; restricted permissions do not provide full product isolation
inside a shared merchant account. Normal receipts intentionally disclose public
merchant/support details, which must be reviewed separately from secret handling.

## Isolated test catalogue

The setup tool creates only test-mode objects, with `metadata.app=aimarketcap`:

- AI Market Cap Data Pro: draft USD 49/month recurring price.
- AI Market Cap Data Business: draft USD 199/month recurring price.
- An AIMC-specific test customer-portal configuration with invoice history,
  payment-method updates, and cancellation at period end. Public portal login
  and subscription switching are disabled.

Product descriptors use `WMS AIMARKETCAP`. No account-wide branding, tax settings,
live product, existing subscription, webhook, or production entitlement is changed.
The test portal links to the site's existing terms and privacy pages for setup
only; subscription/refund terms still require review before paid launch.
Test Checkout sessions now use session-specific `AI Market Cap by WeMakeSense`
branding, the site's black/teal colors, and an explicit test/merchant disclosure.
Shared branding remains unchanged. Stripe invoices still use the account's
branding, not the session override; inspect real receipt/invoice identity before
launch rather than assuming the Checkout customization covers every surface.

Applied test objects on 2026-09-06:

| Object | Stripe test ID |
| --- | --- |
| Data Pro product | `aimc_data_pro_v1` |
| Data Pro monthly price | `price_1UCkIFAneuEOaTi33mq6XZfx` |
| Data Business product | `aimc_data_business_v1` |
| Data Business monthly price | `price_1UCkIHAneuEOaTi3dJyMbYSN` |
| Data API portal configuration | `bpc_1UCkIJAneuEOaTi3gtKcI81d` |

Both test Checkout sessions returned the intended USD amounts and were confirmed
`expired` and `unpaid`. No card was entered and no subscription was created.
The Stripe-hosted Data Pro page was also inspected in an isolated browser at
1440x1000 and 390x844. Its merchant name, USD 49/month price, and test-only product
description were visible; the mobile layout had no horizontal overflow. Stripe
truncates the long merchant name and collapses the product description on mobile.
Local screenshots are in `output/playwright/stripe-data-pro-desktop.png` and
`output/playwright/stripe-data-pro-mobile.png`. These checks did not submit the
form or verify payment completion, receipts, renewal, or entitlement provisioning.
The optional programmatic `inspectSession` callback runs before expiration;
a `finally` block expires the session even if browser inspection fails.

```sh
# Read-only inspection. Uses the existing test key without printing it.
node --env-file=.env.local scripts/setup-stripe-test-catalog.mjs \
  --account acct_1SxKRxAneuEOaTi3

# Create missing test objects and verify Checkout session amounts, then expire
# every smoke session without entering card details or creating a subscription.
node --env-file=.env.local scripts/setup-stripe-test-catalog.mjs \
  --account acct_1SxKRxAneuEOaTi3 --apply --smoke

node --test scripts/setup-stripe-test-catalog.test.mjs
```

The script refuses live keys and wrong account IDs before any write. Stable
product IDs, price lookup keys, and Stripe idempotency keys prevent normal repeat
setup from duplicating the catalogue. Unexpected existing settings fail closed,
instead of being overwritten. API version is pinned to the account's inspected
`2026-01-28.clover` version. A test Checkout session is not a paid subscription,
completed payment, entitlement test, or production conversion.

## Wallet safety changes

The existing wallet webhook could previously credit a signed test-mode payment
or another product's payment with owner-like metadata. The hardening change:

- Acknowledges test events without touching any wallet or production audit row.
- Requires a valid live event mode and explicit `app=aimarketcap` plus
  `purpose=wallet_top_up` metadata before funding.
- Rejects invalid payment amounts and non-PaymentIntent funding references.
- Blocks wallet checkout with a test key, missing webhook secret, or unpinned
  merchant. `STRIPE_EXPECTED_ACCOUNT_ID` must be set to the reviewed account.
- Checks the authenticated account's ban state and Stripe account ID/charging
  capability before creating a session. Requires a live response and a trusted
  Stripe Checkout redirect. Provider credentials never enter client responses.

No wallet checkout was enabled during setup. If enabling in an environment with
older in-flight wallet checkouts, reconcile their missing app/purpose metadata
manually; the new handler deliberately ignores those events. Disabling the UI
flag does not prevent correctly signed, explicitly targeted live payment events
from settling previously completed payments.

## Remaining activation work

1. Dashboard task inspection is complete. Confirm
   whether AIMC is a product of this merchant or an independently operating brand
   that needs a separate account under the same legal entity. Do not fabricate
   legal names, addresses, tax IDs, representative declarations or bank details.
2. Confirm public support contact, merchant disclosure, subscription/refund terms,
   commercial data rights, and final prices. Do not change shared support details
   without checking the impact on the merchant's other products.
3. Implement Data API subscription Checkout, a dedicated customer mapping and
   portal route, signed webhook-driven entitlements, renewal/failure/cancellation
   handling, duplicate/out-of-order event protection, and account-deletion rules.
   Current Data API paid tiers remain administrator-granted pilots.
4. Verify paid/failed/renewed/canceled subscriptions in an isolated database and
   Stripe test environment. Test cross-user access, event replay and reconciliation.
   Never test wallet credit with production funds or grant production paid access
   from a test subscription.
5. Complete required code review and deploy payment safeguards. Create separate
   live products and register the subscription webhook only after its handler is
   deployed and its secret is configured. The existing wallet webhook is not a
   subscription billing integration.
6. Keep payments disabled until receipt/statement identity and the complete
   customer flow are verified. Runpod remains user-owned and billed by Runpod;
   these data API products are not GPU credits.

## Primary references

- [Stripe multiple accounts](https://docs.stripe.com/get-started/account/multiple-accounts)
- [Stripe testing](https://docs.stripe.com/testing)
- [Product creation](https://docs.stripe.com/api/products/create)
- [Price creation](https://docs.stripe.com/api/prices/create)
- [Customer portal configuration](https://docs.stripe.com/api/customer_portal/configurations/create)
- [Subscription Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Checkout branding](https://docs.stripe.com/payments/checkout/customization/appearance?payment-ui=stripe-hosted)
- [Customer receipts](https://docs.stripe.com/receipts)
- [Subscription webhook lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Chrome browser attachment](https://playwright.dev/agent-cli/commands/attach)
