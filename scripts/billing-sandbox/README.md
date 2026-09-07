# Operator-Led Stripe Sandbox Toolkit

This is a local, stateful integration toolkit, not a production setup script or
a one-command CI suite. See `docs/DATA_API_SANDBOX_2026_09.md` for observed results
and limitations. It intentionally refuses live Stripe keys. Never point a test
run at production Supabase or use a real card.

## Prerequisites And Isolation

- Node 22, installed repository dependencies, Docker and Playwright CLI.
- A test key supplied privately as `STRIPE_TEST_SECRET_KEY`, or an existing test
  key in `.env.local`. Do not replace a production credential to run this.
- A reviewed Stripe CLI binary at `output/billing-sandbox/bin/stripe`. The recorded
  run used version 1.50.10 with its release checksum verified.
- The reviewed merchant pin in `harness.mjs`; stop if it does not match. A standard
  test key can establish behavior, not restricted-runtime permission coverage.
- Free loopback ports 3412, 3413, 3415 and 3416, and no pre-existing containers or
  network named `aimc-billing-sandbox*`. Do not stop another project's containers.

The database has no published port. Auth, REST and the app bind only to loopback.
The app blanks variables from `.env.local`, supplies local Supabase credentials,
disables wallet payments and automatic cron execution, and enables only test data
billing. Do not inject additional production credentials into its shell.

## Setup

Run initialization once, then keep the listener and application in separate
terminals. Initialization refuses an existing state file rather than silently
reusing customers or replacing private state.

```sh
node scripts/billing-sandbox/harness.mjs init
node scripts/billing-sandbox/harness.mjs listen
node scripts/billing-sandbox/harness.mjs serve
```

Wait for the listener's redacted readiness message before starting the app.
The exported `createUser`, `app`, `rest`, `stripe`, `state` and `save` helpers are
for operator-coordinated fixtures. `createUser` uses real local GoTrue login;
it does not forge an authenticated user. Use `app` to create API keys and Checkout
sessions, then Playwright to complete hosted test-card and SCA flows. Keep session
URLs, plaintext API keys, passwords and cookies only in the private output area.
Do not print entire response objects or load production environment into Next.

## Fixture Order And Assertions

These checks require the indicated state; they do not fabricate payment success.
Keep fixture preparation and state writes sequential. Assertions fail closed
rather than guessing which Stripe objects belong to the run.

1. Create `users.primary`, a real application API key (`apiKey`), and a Pro
   Checkout through `/api/data-access/checkout`. Verify Free access after the
   decline card, then complete the success card and verify Pro quota through
   `/api/models?view=catalog`. Record `previousInvoice` from this paid contract.
2. Run `verify.mjs guards`, `verify.mjs concurrent` and `verify.mjs replay`.
   Guards creates the separate Free `users.other`; concurrent creates another
   user and an unpaid Checkout. Do not rerun concurrent with the same state.
3. Attach an owned test clock to the primary customer. Exercise renewal,
   `tok_chargeCustomerFail` failure and successful payment recovery through
   Stripe's documented test APIs. Record the owned clock as `clock`. Never pay
   an invoice without checking its customer and test-mode ownership first.
4. Run `verify.mjs refund` against the primary customer's original paid invoice.
   A separate application-linked subscription with `tok_createDispute` can test
   the dispute hold; close that test dispute before cleanup.
5. Use `users.other` for hosted SCA Checkout. Store its real API key as
   `otherApiKey` and its owned test clock as `scaClock`. Complete the 3D Secure
   challenge, verify Pro quota, then use the app-created hosted portal to schedule
   period-end cancellation. Run `verify.mjs cancellation`, then `verify.mjs stale`.
6. Run `verify.mjs reconcile` after the primary refund hold. It calls the actual
   cron route and verifies canonical refresh cannot remove the hold.
7. Close the sandbox browser and run `verify.mjs cleanup` while the local REST
   service remains available. Inspect any failure before retrying; cleanup is
   deliberately ownership-checked, not a broad account-wide deletion command.

Prefix each assertion command above with
`node scripts/billing-sandbox/`. The recorded browser cards were Stripe's
documented decline, success and authentication-required test cards, not real
payment credentials. Generated evidence contains sanitized outcomes only.

## Teardown

Cleanup expires owned open sessions, cancels only owned subscriptions, deletes
only this run's customers/clocks, archives its prices/products, and deactivates
its dedicated portal configuration. Stop this listener and app, then remove only
the three `aimc-billing-sandbox-{auth,rest,db}` containers and the
`aimc-billing-sandbox` network. Preserve private evidence as needed. The state
contains secrets and is not a shareable test report. Do not reuse a cleaned run
as a new run, and do not merge or activate billing merely because tests passed.
