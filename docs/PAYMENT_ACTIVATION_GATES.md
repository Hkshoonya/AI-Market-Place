# Payment Activation Gates

## Scope And Live Preflight, 2026-09-06

The owner requested activation and required changes after referral PR #36. Its
required code-owner review remains a separate deployment gate. Do not bypass
review or merge unrelated Runpod/dependency branches to switch on payments.

The production Stripe credential resolves to the configured, reviewed WeMakeSense
merchant. Stripe reports charges and payouts enabled and card payments active.
The merchant pin matches, and live server/publishable keys plus a webhook secret
are present. The payment flag remains false. These are read-only checks, not
evidence of a completed customer payment or a full account-security audit.

The stable AIMC Data Pro and Data Business product IDs from the prior test setup
return 404 with the live credential. No live product was created. No bank details,
shared branding, receipt settings, prices, existing subscriptions or webhooks were
modified. At that preflight the server key was a standard key. A later
owner-provided restricted live key now passes the Accounts Read check and matches
the pinned merchant with charging enabled. Other runtime permissions still need
isolated integration verification. Do not rotate keys used by other applications.

## Safety Changes

This standalone change extracts payment guards from PR #32 without its stacked
Runpod work, test catalogue setup, or paid-launch feature. It also closes privacy
and input-handling gaps found during the activation review:

- Checkout requires a live credential, signing secret, pinned merchant and
  authenticated, non-banned profile. The account ID and charging capability are
  verified before creating a session; redirects must use Stripe Checkout.
- A signed test payment cannot credit a spendable wallet or write audit records.
  Live funding requires explicit AIMC/wallet-purpose metadata, a positive integer
  minor-unit amount and a PaymentIntent reference.
- Unrelated shared-merchant events are acknowledged without database access.
  Targeted payment audits retain only allowlisted wallet metadata, not arbitrary
  payment notes or customer details. Existing historical audit records are not
  deleted or rewritten by this change.
- Signatures use constant-time decoded-hex comparison with strict timestamp and
  signature parsing. Request bodies are capped while streaming, including when
  Content-Length is missing or misleading.
- The merchant pin is preserved by the Railway infrastructure configuration.
  No deployment, environment flag change, charge, refund or wallet credit is
  performed merely by preparing this branch.

Older in-flight wallet sessions without the new metadata need explicit manual
reconciliation. Correctly signed, targeted live settlements continue to be
processed even when new checkout is disabled, so completed payments are not lost.

## Not Yet Ready For Paid Launch

Data API access in production is still an administrator-approved pilot. The
separate subscription implementation now prepares Checkout, dedicated customer
mapping, signed entitlement updates, renewal/failure/cancellation handling and
lease-fenced reconciliation. These changes are not activated by the wallet
safeguards. Follow [the data billing runbook](DATA_API_BILLING.md) before deploying
or enabling them. Do not enable wallet top-ups as a substitute or describe
deposited balances as earned subscription revenue.

Before enabling customer charges, complete required review/deployment, isolate
the integration credential, verify the deliverable and pricing/data rights, and
test payment completion, receipt/statement identity, refunds/disputes and access
revocation in an isolated environment. Never use real customer charges for a
smoke test or connect test subscriptions to production paid entitlements.

This targeted pass checks payment configuration, authenticated Checkout guards,
webhook authenticity, cross-product isolation and body limits. It does not
verify every auth/admin route, database permission, dependency vulnerability,
MFA setting, public client asset, billing-policy requirement or payout flow.
The application is therefore not yet verified for public paid launch.

## Primary References

- [Stripe webhook verification and testing](https://docs.stripe.com/webhooks)
- [Stripe API keys and restricted keys](https://docs.stripe.com/keys)
- [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks)
