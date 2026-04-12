# AI Market Cap Deployment Guide

Production target: `aimarketcap.tech`

This repository is configured for:
- Railway running the app container from `Dockerfile`
- Supabase Cloud as the database
- Railway in-process cron as the scheduler of record
- GitHub Actions for CI/CD and manual cron recovery only

## Production contract

The live deployment should use exactly one primary scheduler.

- Primary scheduler: Railway in-process cron through `server/custom-server.js`
- App runtime: `CRON_RUNNER_MODE=internal`
- GitHub Actions cron: manual recovery only through `workflow_dispatch`
- External cron: optional local/manual recovery path only, not the default

The cron lock is designed to tolerate overlap during a cutover window, but overlap should not be the steady-state design.

## Required environment variables

At minimum:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<strong-random-secret>
NEXT_PUBLIC_SITE_URL=https://aimarketcap.tech
CRON_RUNNER_MODE=internal
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
- Railway deployments should run with `CRON_RUNNER_MODE=internal`.
- If an old Railway env still says `CRON_RUNNER_MODE=external`, the runtime now coerces it back to `internal`.
- Do not run an external cron host against the same Railway production app as steady state.
- Keep `RATE_LIMIT_BACKEND=database` in production so rate limits are shared across instances and cold starts.
- Keep `ENABLE_MARKETPLACE_FEES=false` until you intentionally want marketplace escrow releases to deduct platform fees again.

## Railway deployment

The container entrypoint remains `server/custom-server.js`, and with `CRON_RUNNER_MODE=internal` it serves the app and schedules cron jobs internally on Railway.

Railway should deploy the service from:

```text
railway.json -> Dockerfile -> node server/custom-server.js
```

The Railway in-process scheduler currently owns jobs such as:
- tiered source sync
- auction settlement
- wallet deposit scan
- deployment reconcile
- score computation
- resident-agent maintenance

Build-time environment requirements:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
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

## External cron setup

External cron is no longer the recommended steady-state production scheduler. Keep this section only for local/manual recovery or migration windows.

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

Do not add scheduled GitHub Actions cron while Railway in-process cron is the scheduler of record.

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
- reports the effective cron mode after Railway safety coercion
- reports recent cron activity from `cron_runs`

Authenticated health calls are more informative than anonymous ones.

## Rollout notes

Safe deployment order:
1. Apply database migrations.
2. Deploy the app with `CRON_RUNNER_MODE=internal` and `CRON_SINGLE_RUN_LOCK=true`.
3. Confirm the durable rate-limit migration is applied and `RATE_LIMIT_BACKEND=database` is present in the environment.
4. Confirm `/api/health` shows internal cron mode and recent cron activity.
5. Do not leave an external cron host enabled against the same production app.
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
