# Independent uptime and recovery monitor

This Worker runs outside the Railway web process, with a one-minute Cron trigger
and one SQLite-backed Durable Object for `aimarketcap.tech` coordination. It does
not run model updates, migrate data, change billing, rebuild images or touch Stripe.

It probes the uncached public `/api/health` endpoint with a bounded timeout/body.
The application's `healthy` and `degraded` responses both establish liveness;
they do **not** establish data freshness or complete functional correctness.
A cached homepage alone only produces the monitor state `degraded`.

After two failed API-readiness checks it sends an owner alert via the existing
Resend sender. A restart requires Railway to confirm the fixed AI Market Cap
project/environment/service's **latest** deployment is `CRASHED`. Running,
deploying, removed and failed-build deployments are not restarted. No database,
other Railway service or user-selected destination can be targeted.
Healthy checks also verify the recovery token's fixed scope every six hours,
without requesting a restart. The last successful scope-check time is public.

Recovery attempts have a 30-minute cooldown and a maximum of three per UTC day.
An ambiguous/failed restart request consumes the attempt, preventing rapid loops.
The durable lease is reserved before external I/O; duplicate/concurrent cron
events do not trigger duplicate actions. Restart cooldowns survive Worker restarts.
Notifications have stable idempotency keys, no raw provider diagnostics and bounded
attempts. Owner alert/recovery email does not certify payment/login/data pipelines.

The public GET `/` exposes only health/timestamps/counters. All other routes and
methods return 404. There is no public restart endpoint. A revision-scoped bootstrap
alarm verifies each deployment once; Cron handles subsequent
checks. The scheduled trigger can take time to propagate, so verify actual checks.

Secrets are `RAILWAY_TOKEN` (project-scoped) and `RESEND_API_KEY`, installed through
Wrangler secrets, never source/config vars. `.env.example` contains fixture values
for offline type generation only; `.dev.vars` is ignored. Do not run local dev with
real recovery credentials. Generated runtime declarations are ignored and rebuilt
from the configuration in CI rather than checked in as thousands of vendor lines.

## Verification

```bash
node --test cloudflare/uptime-monitor/src/recovery.test.mjs
npx wrangler types cloudflare/uptime-monitor/worker-configuration.d.ts -c cloudflare/uptime-monitor/wrangler.jsonc --env-file cloudflare/uptime-monitor/.env.example --strict-vars=false
npx tsc -p cloudflare/uptime-monitor/tsconfig.json
npx wrangler deploy --dry-run -c cloudflare/uptime-monitor/wrangler.jsonc
```

Failure/recovery scenarios are simulated in tests. Never crash production merely
to test recovery. Verify live Worker state and actual owner mail separately.
Cloudflare credentials must be scoped to the intended account; deployment does
not authorize a plan upgrade or any unrelated resource changes.

## Maintenance and cutover

Set `AUTO_RECOVERY_ENABLED=false` and deploy **before** intentionally stopping or
retiring the Railway origin, including the Supabase/VPS migration writer freeze.
Set `MONITOR_ENABLED=false` to stop all probes/alerts during planned maintenance.
Re-enable only after selecting a single authoritative origin. Remove the Railway
secret/recovery integration after retiring that service. Do not let an uptime
watchdog undo an intentional maintenance/cutover operation.
