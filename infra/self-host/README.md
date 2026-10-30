# Self-host migration

## Current state: October 30, 2026

Preparation and isolated rehearsal only. No server has been purchased, DNS has not
been switched, and paid Supabase/Railway resources have not been cancelled.
The owner approved **$10 monthly billing, no annual prepayment**, US billing,
using their specified business email. OVH registration still requires successful
verification; never invent an address, phone number or billing identity.

Supabase renewal: **November 20, 2026**, billing time zone unconfirmed.
Target verified cutover by **November 18**, allowing 24-48 hours observation and
rollback planning. This file is not a scheduled task or continuous monitoring.

The October 26 export has PostgreSQL 17.6, approximately 1.94 GB including indexes,
13 users, 14 identities and 86 public tables, all with RLS enabled. Storage has no
buckets/objects. The October 30 rehearsal authenticated 1,724 archive entries,
restored original owners/ACLs in one transaction, and matched row counts for **113
archived public/auth tables**. This does not establish per-cell equality or prove
that the live database has not changed since the export.

## Architecture and costs

The proposed OVH VPS-2 has 4 vCPU, 8 GB RAM, 75 GB NVMe and an included previous-day
backup. The advertised $8.50 rate requires $102 annual prepayment; the approved
monthly term is $10 before tax, subject to checkout/stock verification.
See [OVH VPS](https://us.ovhcloud.com/vps/) and its US checkout catalog.
4 GB is not a comfortable allowance for PostgreSQL, Next.js and concurrent jobs.
Use external providers for inference; this server has no GPU and must not run model weights.
Offsite backups, domain renewal and paid email/provider usage are separate costs.
A single VPS is a single point of failure and requires ongoing patching/operations.

The stack self-hosts open-source Supabase PostgreSQL/Auth and PostgREST behind
Caddy. It removes the managed subscription, **not** the Supabase client/API architecture.
It retains hashes, identities, SQL functions, RLS and application data. No Studio,
Storage, Realtime or management API is exposed. Existing code has no Storage/Realtime
client dependency. New JWT signing keys require users to sign in again.

All service images/bootstrap revisions are pinned. Only Caddy exposes public
ports 80/443; database, REST, Auth and template ports remain private. Restored
pg_cron jobs are disabled. Keep Cloudflare as the single external app scheduler;
do not also enable internal Railway/Next scheduling. Existing schedules are unchanged.

## Backup and rehearsal commands

Use private persistent directories outside the source repository, not RAM.
The workstation restarted between sessions and erased RAM-only work; recovered
code is now on disk. The encrypted archive survived in Docker volume
`aimc-migration-backup-20261026`, with the separate owner-protected recovery key.
An encrypted persistent filesystem copy and current encrypted Railway configuration
were also recovered/exported on October 30. These are **local**, not offsite backups.
Never commit/upload the key or unencrypted provider/Auth/runtime configuration.

```bash
node --env-file=/private/source.env scripts/self-host/migrate.mjs inventory
node --env-file=/private/source.env scripts/self-host/migrate.mjs backup \
  --directory /private/export-NEW --key /private/keys/migration.key --create-key
node scripts/self-host/migrate.mjs verify \
  --directory /private/export-NEW --key /private/keys/migration.key
node scripts/self-host/prepare.mjs --rehearsal \
  --runtime-dir /private/runtime --state-dir /private/state
```

Omit `--create-key` to reuse a protected existing 32-byte key. Archives use
authenticated AES-256-GCM; failed authentication removes partial plaintext.
Source TLS verifies a pinned Supabase CA. Dumps use the session pooler on 5432,
not the transaction pooler or unavailable direct IPv6 endpoint. Roles are exported
without passwords; OAuth/SMTP Auth settings are encrypted.

Start only DB first, before GoTrue initializes fresh Auth state:

```bash
cd infra/self-host
docker compose --env-file /private/runtime/stack.env -p aimc-migration-YYYYMMDD \
  -f compose.yml -f compose.rehearsal.yml up -d db
cd ../..
node scripts/self-host/migrate.mjs restore-rehearsal \
  --directory /private/export-NEW --key /private/keys/migration.key \
  --container aimc-migration-YYYYMMDD-db-1
```

The guard requires an empty app database, isolated labelled container and no
published DB ports. Missing archived owner roles are created NOLOGIN. Never
remove these guards to target production. After restore apply missing reviewed
migrations, then start Auth/REST/gateway/mailpit using the same Compose flags.
`AIMC_RUNTIME_DIR=/private/runtime node scripts/self-host/smoke-auth.mjs` exercises
real local signup/confirmation/login/logout, private-column grants, tenant
isolation and privilege checks, then deletes only its own fixture accounts.
All emails go to the local sink. No production messages are sent.

## Cutover gates

1. Finish account verification, confirm actual monthly price/stock and provision a
   supported Linux LTS. Use SSH keys and a non-root operator. Verify a second session
   before disabling password/root login. Enable security updates, time sync, firewall,
   resource alerts and tested restore access. Docker operator privileges are root-equivalent.
2. Coordinate rotation of credentials captured by an erroneous diagnostic command.
   The replacement Railway token now authenticates and was not printed. Current
   Railway runtime export contains the provider-credential encryption key, CRON secret,
   Resend key, Stripe webhook secret and Stripe account pin. Preserve the provider
   encryption key: changing it would make stored provider connections unreadable.
   Rotate source/database keys only together with all affected runtime/build clients;
   never strand the live app or modify unrelated Stripe account services/payouts.
3. Deploy the tested profile grant hotfix and patched application through review.
   Source management/API access currently times out from this workstation, so
   migration 112 has been tested/applied **only on the clone**, not production.
   Existing migrations 110/111 from PR 46 are also pending. Apply only missing
   migrations; never replay the full history or reuse reserved migration 099.
4. Build outside the small VPS with the **new public API URL and anon key**.
   Next.js bakes public variables into browser bundles; Compose environment alone
   cannot change them. Pin the reviewed application image by digest. Check images,
   browser bundles and layers for vulnerabilities and accidentally included secrets.
5. Generate production configuration with `prepare.mjs --auth-config ...
   --runtime-config ... --app-image ...@sha256:...`. Defaults are private
   `/etc/aimarketcap` and persistent `/var/lib/aimarketcap`. Verify all exported
   SMTP/OAuth credentials are non-redacted and add the new Google callback without
   removing the old callback during observation. Test real Google/password login.
6. Verify public HTTPS, strict origin TLS, cookies, resets, redirects, CSRF/origin
   protections, admin/tenant boundaries, input handling and abuse controls. Auth's
   13 templates contain the AI Market Cap name/logo. Real delivery, contact mail,
   signup/login notifications and app-only payment/subscription receipts still
   require complete deployment testing; new durable email-outbox work was RAM-only
   and is not included in this recovered implementation. Do not claim it deployed.
7. Configure offsite encrypted backups and independently restore one. Check table
   counts, identities, ledger totals, history, grants/RLS and representative values.
   Define RPO/RTO and retention. Provider snapshots alone do not satisfy this gate.
8. Freeze **all writers**, including public mutations, Auth, webhooks, admin jobs,
   Cloudflare dispatch and any internal jobs. Drain in-flight work, verify writes
   stopped, and take a fresh final export. Restore/compare again before destination
   writes. The October rehearsal is not a final transfer; automated production
   restore/cutover is deliberately not provided by the guarded rehearsal CLI.
9. Switch app/API configuration and DNS, then verify login/contact/workspace/admin,
   connected providers, paid API entitlements/quotas and isolated Stripe webhook
   tests. Do not charge real customers to test. Re-enable exactly one scheduler and
   verify freshness and first due runs against the destination.
10. Keep the source intact/read-only for 24-48 hours. DNS-only rollback is safe only
    before new destination writes; after that freeze and reconcile deltas first.
    Never permit two independent writable databases. Only after observation and
    restore checks retire old resources. Confirm Supabase **organization** billing:
    removing one project does not necessarily cancel Pro, and unrelated projects
    must not be downgraded/deleted. Verify Railway billing separately.

The project is **not yet verified for public launch on the new server**. See
`security-readiness-20261030.md` for current findings and remaining verification.
