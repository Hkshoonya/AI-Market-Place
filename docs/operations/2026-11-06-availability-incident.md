# Website availability incident: 2026-11-06

## Evidence and recovery

- Railway logged a fatal Node/V8 heap exhaustion at 09:39:54 UTC. Garbage
  collection retained approximately 1,975 MB in a roughly 2 GB heap. The service
  had an 8 GB container allowance; these are different limits.
- The public site returned HTTP 502 and Railway reported the web deployment as
  crashed. There was no VPS/DNS migration or Supabase cancellation.
- Restarting the existing deployment restored the process at 10:01:56 UTC.
  Homepage, model-directory and uncached health responses subsequently returned
  HTTP 200. An uncached API check, not only a cached homepage, is required.
- With explicit emergency-release authorization, the service deployed exact
  commit `d664ef873d0b6504446c16ca2ae6d845baebd579` without merging around GitHub
  review or changing the connected source branch. Public release metadata and
  Railway both confirmed the new revision at 10:56 UTC.
- The first build attempt failed before replacing the recovered instance:
  npm 10.9.9 rejected the previous AJV lock layout. Regenerating the lockfile in
  a clean Alpine environment corrected the mismatch. Clean installs passed with
  both local npm 10.9.7 and the container's npm 10.9.9.

## Memory and monitoring changes

Creating default Supabase clients repeatedly reproduced one retained Auth refresh
interval per client. Service-role and anonymous server database clients do not
own interactive sessions. The shared stateless factory disables refresh,
persistence and URL session detection while preserving database transport options.
All direct server SDK factories use it; a source-level regression test prevents
new bypasses. Cookie/session and browser clients retain their existing behavior.
This fixes a demonstrated retention defect, not proof that it was the sole source
of every byte retained before the crash. Long-duration memory observation remains
necessary.

An independent Cloudflare Worker checks every minute with a SQLite Durable Object
lease. Two failed readiness checks produce a bounded owner notification through
the existing Resend sender. Recovery requires the fixed project/environment/web
service's latest Railway deployment to be `CRASHED`. It never restarts a running,
deploying, removed or failed-build deployment, or a database. Cooldown is 30 minutes;
the limit is three requests per UTC day, including ambiguous responses.

Live checks and token-scope reads were verified from Cloudflare. Resend accepted
the activation message; inbox receipt is not independently established. Recovery
failure scenarios are simulated, not tested by crashing production. Workers use
manual redirect handling and reject 3xx responses; credential-bearing redirects
are never followed. The status endpoint exposes no restart operation or secrets.

Disable automatic recovery before a planned Railway/VPS cutover. See the
[monitor runbook](../../cloudflare/uptime-monitor/README.md). GitHub review remains
required: an unrelated deployment from old main would otherwise omit this fix.

## Verification and remaining work

The initial release passed 1,922 unit tests, 364 component tests, production build,
lint and typecheck. Desktop/mobile browser tests passed 73 cases, with 8 skipped.
The complete stateless-factory follow-up adds two unit regressions and 14 separate
monitor scenarios, covering transport preservation, source-level bypasses, leases,
recovery limits, scope checks, maintenance and credential-safe redirect handling.
Live homepage, directory and login navigation returned 200 with no uncaught browser
errors during the sampled navigations. Unauthenticated admin-user and provider
connection APIs returned 401. These are not exhaustive authorization tests.

Immediately after startup a model API request timed out and another returned 500;
three subsequent requests returned 200 in approximately 1.8-3.3 seconds. Do not
erase this transient from the incident assessment or treat one successful probe
as a complete performance test.

Authenticated health after release established database connectivity, an external
cron scheduler with recent activity, and healthy crawl routes. It reported 36
healthy data sources and one down source: `vision-arena`, whose last success was
October 12. One failed cron execution remained in the 24-hour window. Do not mask
this warning or label all data fresh merely because liveness is restored.

The current production dependency audit has five moderate findings in the Sentry
bundler/glob dependency chain and no high/critical findings. This emergency change
does not introduce an untested major Sentry upgrade. Local mocked E2E runs also emit
hydration/stream/WebGL diagnostics despite passing assertions; investigate them
separately rather than claiming the test logs are warning-free.

No production database migration, billing/Stripe change, hosting purchase or DNS
cutover was performed. Full production sign-up/reset/OAuth/MFA, payment processing,
tenant/object authorization and abuse testing were not completed in this incident.
The project is not yet verified for a public monetization launch.
