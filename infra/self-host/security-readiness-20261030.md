# Migration security readiness: October 30, 2026

## Assessment

**Not verified for public launch or source cancellation.** This is a targeted
migration review and isolated rehearsal, not a complete audit of every application
route. No production compromise was established and no production data was deleted.

## Critical findings

1. **Patched dependencies are not yet deployed.** The old application/PR 46 package
   set predates newly disclosed Next/Sentry and other fixes. Impact: affected features
   may expose code-execution, authorization-bypass or denial-of-service risks described
   by their upstream advisories. The recovered branch uses Next 16.4.3, patched Sentry,
   DOMPurify/undici/Zod and tooling; assess actual feature reachability during review.
   A clean production npm audit is not evidence of deployment or universal security.
   See `package.json` and `package-lock.json`.

## High-risk findings

2. **Overbroad profile grants in the exported source schema.** Public row-level read
   policies combined with table-wide grants allowed reads of profile email/private
   fields. Test clone evidence also shows broad column-write permissions. Migration
   `supabase/migrations/112_protect_private_profile_columns.sql:4` replaces these
   with explicit directory reads and safe self-edit columns, retaining RLS and trusted
   server access. Regression and real local Auth/REST tests pass. Live preflight
   times out, so this has **not** been applied/verified on production.

3. **Credential values captured in a diagnostic output.** A faulty redaction pattern
   included source credentials and Cloudflare/Railway token values in tool output.
   No values are recorded here or in source changes. Treat the affected credentials
   as requiring coordinated rotation. The backup encryption key was not included.
   The replacement Railway token now authenticates and was not printed. Rotating
   source keys without updating deployed clients would break login/data access;
   coordinate the rollout and audit access rather than doing a blind reset.

4. **No offsite recovery or production host yet.** Persistent local AES-GCM archives
   and the independent key survived the workstation restart; a full local restore
   now matches 113 archived table row counts. This is not offsite recovery, final
   cutover consistency or protection against disk/account loss. Never cancel source
   billing based solely on this rehearsal.

## Verification performed

- Authenticated three encrypted export files and checked 1,724 archive entries.
- Full single-transaction restore retained schema/owners/ACLs and matched 13 users,
  14 identities, 86 public tables and 86 public RLS tables; archived table row counts
  matched for 113 public/auth tables. No stored cell-level digest comparison was run.
- Real local signup requires confirmation; the actual mail sink received the branded
  confirmation. Password login/getUser, own edit, cross-user edit denial, private
  email denial, self-admin denial and refresh-token revocation pass.
- Anonymous missing API keys and foreign browser origins are denied at the gateway.
  SQL grant regression tests exercise idempotency and trusted service-role access.
- Runtime/config stays outside source, templates are internal-only, DB has no host
  port, restored cron jobs are disabled, and containers have bounded resources/logs.
- Production dependency audit reports zero known vulnerabilities. Full audit retains
  three **low-severity development-tool entries** involving deepmerge/shadcn; do not
  force-downgrade tooling to clear the report. Monitor an upstream patch.

## Remaining verification

Review/merge gates, current source reachability, source hotfix application, credential
rotation, actual VPS firewall/TLS, real OAuth and SMTP/Resend deliverability, branded
contact/payment notifications, app-only Stripe webhook/account isolation, persistent
email queue recovery, API quotas, full route authorization/IDOR and input/SSRF/XSS
coverage, CSRF and rate-limit abuse cases, container image scanning, final writer
freeze/restore, financial/data reconciliation, offsite restore, scheduled job freshness,
monitoring and post-cutover rollback remain release gates. Local tests do not replace
these checks. Build warnings using dummy E2E JWT values are not production validation.
