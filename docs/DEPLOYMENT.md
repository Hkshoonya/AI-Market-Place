# AI Market Cap Deployment Guide

Production target: `aimarketcap.tech`

This repository is configured for:
- Railway running the app container from `Dockerfile`
- Supabase Cloud as the database
- Cloudflare cron dispatcher as the scheduler of record
- GitHub Actions for CI/CD and manual cron recovery only

This guide now supports one optional supplemental Railway cron service for fast launch-signal pickup. It is not a second primary scheduler.

## Production contract

The live deployment should use exactly one primary scheduler.

- Primary scheduler: Cloudflare cron dispatcher through `cloudflare/cron-dispatcher`
- App runtime: `CRON_RUNNER_MODE=external`
- GitHub Actions cron: manual recovery only through `workflow_dispatch`
- Railway in-process cron: fallback only, not the default

The cron lock is designed to tolerate overlap during a cutover window, but overlap should not be the steady-state design.

## Required environment variables

At minimum:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<strong-random-secret>
NEXT_PUBLIC_SITE_URL=https://aimarketcap.tech
CRON_RUNNER_MODE=external
CRON_SINGLE_RUN_LOCK=true
RATE_LIMIT_BACKEND=database
ENABLE_MARKETPLACE_FEES=false
```

Recommended compatibility and enforcement flags during rollout:

```env
ENFORCE_WITHDRAW_SCOPE=false
ENFORCE_SELLER_VERIFICATION=false
BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY=false
```

Optional marketplace payment variables:

```env
STRIPE_SECRET_KEY=<stripe-server-secret>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-signing-secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe-publishable-key>
```

Optional contact email variables:

```env
RESEND_API_KEY=<resend-api-key>
CONTACT_EMAIL_FROM="AI Market Cap <support@aimarketcap.tech>"
CONTACT_EMAIL_TO=support@aimarketcap.tech
```

Without `RESEND_API_KEY`, public contact submissions are still saved in Supabase
and surfaced as admin notifications, but no email is sent to the support inbox.

Optional agent-provider routing variables:

```env
OPENROUTER_API_KEY=<recommended-default-provider>
DEEPSEEK_API_KEY=<optional-direct-fallback>
MINIMAX_API_KEY=<optional-direct-fallback>
ANTHROPIC_API_KEY=<optional-direct-fallback>
```

After the compatibility window:

```env
ENFORCE_WITHDRAW_SCOPE=true
ENFORCE_SELLER_VERIFICATION=true
BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY=true
```

Important:
- Railway deployments should run with `CRON_RUNNER_MODE=external` when Cloudflare owns scheduling.
- The runtime now honors explicit `CRON_RUNNER_MODE=external` on Railway.
- Do not leave Railway internal cron enabled once the Cloudflare dispatcher is deployed.
- Keep `RATE_LIMIT_BACKEND=database` in production so rate limits are shared across instances and cold starts.
- Keep `ENABLE_MARKETPLACE_FEES=false` until you intentionally want marketplace escrow releases to deduct platform fees again.

## Railway deployment

The container entrypoint remains `server/custom-server.js`. With `CRON_RUNNER_MODE=external` it serves the app only and expects Cloudflare to call the cron routes.

Railway should deploy the service from:

```text
railway.json -> Dockerfile -> node server/custom-server.js
```

The Railway app still owns the job implementation for routes such as:
- tiered source sync
- auction settlement
- wallet deposit scan
- deployment reconcile
- score computation
- resident-agent maintenance

## Cloudflare cron dispatcher

Deploy the scheduler worker from:

```text
cloudflare/cron-dispatcher
```

Worker config:
- one Cloudflare Cron Trigger: `*/5 * * * *`
- shared job table from `config/cron-jobs.json`
- dispatch target: `https://aimarketcap.tech`
- auth: `CRON_SECRET` secret in the Worker

Deploy steps:

```bash
printf '%s' "$CRON_SECRET" | npx wrangler secret put CRON_SECRET -c cloudflare/cron-dispatcher/wrangler.jsonc
npm run deploy:cloudflare-cron
```

The Worker computes which jobs are due at each 5-minute tick and calls the existing Railway cron routes with `Authorization: Bearer <CRON_SECRET>`.

Manual verification:

```text
GET  https://<worker-subdomain>.workers.dev/
POST https://<worker-subdomain>.workers.dev/run      # requires Authorization: Bearer <CRON_SECRET>
```

Build-time environment requirements:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- optional: `NEXT_PUBLIC_POSTHOG_KEY`
- optional: `NEXT_PUBLIC_POSTHOG_HOST`
- optional: `SENTRY_AUTH_TOKEN`

Runtime recommendation for autonomous maintenance:
- Set at least one LLM provider key for the resident-agent router.
- Recommended order: `OPENROUTER_API_KEY` first, then optional direct `DEEPSEEK_API_KEY`, `MINIMAX_API_KEY`, and `ANTHROPIC_API_KEY`.
- Without any of these keys, resident agents still run, but LLM-backed analysis paths degrade to non-LLM behavior.

Set the application domain to:

```text
aimarketcap.tech
```

Set the public origin to:

```text
https://aimarketcap.tech
```

## Manual recovery cron setup

External shell cron is now a manual recovery path only. Keep this section only for local/manual recovery or migration windows.

Copy the helper script to a temporary recovery host only when needed:

```bash
scp scripts/cron-jobs.sh root@<RECOVERY_HOST>:/opt/aimc/scripts/cron-jobs.sh
ssh root@<RECOVERY_HOST> "chmod +x /opt/aimc/scripts/cron-jobs.sh"
```

Create the cron environment file:

```bash
cat > /opt/aimc/.env << 'EOF'
AIMC_BASE_URL=https://aimarketcap.tech
CRON_SECRET=<same-secret-as-app>
EOF
```

If the cron runner lives on the same box as the app, you can use a private URL such as `http://localhost:3000`. If it runs outside the app host, point `AIMC_BASE_URL` at the public Railway URL.

Install the crontab entries:

```cron
SHELL=/bin/bash

# Data sync
0 */6 * * *    source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh sync-t1
0 */12 * * *   source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh sync-t2
0 8 * * *      source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh sync-t3
0 0 * * 1      source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh sync-t4

# Marketplace / scoring
*/5 * * * *    source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh auctions
45 */6 * * *   source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh compute-scores

# Agents
30 */6 * * *   source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh pipeline
0 9 * * *      source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh code-quality
0 10 * * 1     source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh ux-monitor
```

Manual single-source recovery is also supported:

```bash
source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh sync-source vision-arena
source /opt/aimc/.env && /opt/aimc/scripts/cron-jobs.sh sync-source arena-hard-auto
```

## GitHub Actions cron

`.github/workflows/cron-sync.yml` is a manual recovery path, not the primary scheduler.

Use it with `workflow_dispatch` only when Railway cron needs manual recovery.

Do not add scheduled GitHub Actions cron while Cloudflare is the scheduler of record.

## Stripe webhook readiness

Marketplace wallet checkout requires all three Stripe variables listed above. The webhook endpoint is:

```text
/api/webhooks/stripe
```

At minimum, Stripe should send `checkout.session.completed` and `payment_intent.succeeded`, which are the events used by the wallet deposit flow. After changes, verify private health:

```text
/api/health
/api/pipeline/health
/api/admin/pipeline/health
```

Authenticated responses expose `payments.stripe.status` as `ready`, `partial`, or `disabled`. `partial` means checkout or webhook delivery is not fully configured and wallet credits may not complete.

## Health checks

Use:

```text
/api/health
```

Behavior:
- returns `503` when the app cannot reach the database
- reports the effective cron mode
- reports recent cron activity from `cron_runs`

Authenticated health calls are more informative than anonymous ones.

## Rollout notes

Safe deployment order:
1. Apply database migrations.
2. Deploy the app with `CRON_RUNNER_MODE=external` and `CRON_SINGLE_RUN_LOCK=true`.
3. Confirm the durable rate-limit migration is applied and `RATE_LIMIT_BACKEND=database` is present in the environment.
4. Deploy the Cloudflare cron dispatcher and set its `CRON_SECRET`.
5. Confirm `/api/health` shows external cron mode and recent cron activity.
6. Do not leave Railway internal cron enabled against the same production app.
6. Keep GitHub Actions cron manual-only unless Railway cron ownership intentionally changes.
7. After observing deprecated-path logs, enable the enforcement flags.

## Troubleshooting

- `401` from cron routes: `CRON_SECRET` does not match.
- `202` from cron routes: another runner already holds the cron lock.
- Rate limits reset unexpectedly across instances: `RATE_LIMIT_BACKEND` is missing or the durable rate-limit migration was not applied.
- Health says `external` on Railway: Railway runtime markers are missing or the deployment is not running in the expected Railway environment.
- Nothing runs and health says `internal`: confirm the app is still using `server/custom-server.js` as the start command.
- Build succeeds locally but Railway fails: confirm the deploy is building the latest `main` commit from `Dockerfile`, not a stale cached deployment.
- GitHub Actions is triggering cron jobs unexpectedly: confirm `.github/workflows/cron-sync.yml` still has only `workflow_dispatch`.
- Stripe checkout opens but wallets are not credited: check authenticated health for `payments.stripe.status` and confirm the webhook signing secret is present in Railway.
