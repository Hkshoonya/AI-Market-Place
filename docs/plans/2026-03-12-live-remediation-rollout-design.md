# Live Remediation Rollout Design

> Approved production strategy for fixing the 2026-03-12 audit findings without hard-breaking the live site.

**Goal:** Close the confirmed security, correctness, and runtime issues in `aimarketcap.tech` while preserving production stability and partner integrations.

**Architecture:** Use a safety-first compatibility rollout. High-risk fixes ship in narrow releases, breaking behavior moves behind flags first, and runtime/schema cleanup happens before deep behavior enforcement. Every release must be observable, reversible, and validated in staging before production.

**Production contract:**
- Canonical runtime target: Railway app container built from `Dockerfile`, behind Cloudflare, with external VPS cron as scheduler of record, as documented in [docs/DEPLOYMENT.md](F:/BotProject/AI Market Cap/docs/DEPLOYMENT.md).
- Compatibility window: existing behavior may continue briefly if it is logged, deprecated, and protected by a kill switch.
- Rollback contract: no release mixes irreversible schema cuts with enforcement cuts.

---

## Release 1: Silent Clamps

**Purpose:** Close exploit paths and false signals with minimal product-surface change.

**Changes:**
- Fix broken RLS policy created by migration `007`.
- Enforce API-key expiry on bot marketplace routes by reusing shared auth.
- Return real `503` from `/api/health` when the DB is unreachable.
- Stop classifying arbitrary `sb-*` cookies as valid human sessions in the paywall.
- Stop building redirects from request-derived host/origin values.
- Normalize canonical site URL to the production domain.

**Expected blast radius:** Low.

**Rollback:** App rollback plus reversible RLS migration.

---

## Release 2: Compatibility Scaffolding

**Purpose:** Introduce the safer contract before enforcing it.

**Changes:**
- Add dedicated withdrawal scope support.
- Add feature flags for withdraw enforcement, seller verification enforcement, guest account-bound delivery blocking, paywall strictness, and canonical origin strictness.
- Add structured deprecation logs for:
  - withdrawals using legacy scopes
  - unverified seller listing creation
  - guest purchases of account-bound listings
- Prepare seller-gating state and admin-review flow without enforcing it immediately.

**Expected blast radius:** Low to medium, but controlled by flags.

**Rollback:** Turn flags off and keep compatibility path active.

---

## Release 3: Runtime Stabilization

**Purpose:** Make the live runtime truthful and coordinated before deeper behavior changes.

**Changes:**
- Establish one scheduler of record or add a real distributed/DB lock around cron entry points.
- Remove fake cron-health reporting or wire it to real execution state.
- Align runtime docs/config with the actual deploy path.
- Reconcile migration numbering and schema prerequisites so new migrations are trustworthy.

**Expected blast radius:** Medium, because cron behavior changes.

**Rollback:** Re-enable previous scheduler path if needed, but keep locks/observability.

---

## Release 4: Enforcement

**Purpose:** Turn on the safer behavior once compatibility telemetry is clean.

**Changes:**
- Enforce dedicated withdraw scope.
- Enforce seller verification or moderated listing state.
- Block guest auto-delivery for account-bound goods.
- Fix marketplace correctness issues that directly affect trust, including price-sort behavior.

**Expected blast radius:** Medium, but bounded by telemetry and prior flagging.

**Rollback:** Turn enforcement flags off while keeping logs on.

---

## Release 5: Cleanup and Hardening

**Purpose:** Finish the structural work after runtime and behavior are stable.

**Changes:**
- Tighten CSP for production.
- Replace decorative in-memory rate limiting with durable rate limiting.
- Finish schema/migration reconciliation and regression coverage.
- Remove deprecated compatibility paths once production usage is gone.
- Address remaining frontend/performance/accessibility issues that are not immediate prod risks.

**Expected blast radius:** Medium if bundled poorly, low if split by concern.

**Rollback:** Per-change rollback; avoid bundling unrelated cleanup into one deploy.

---

## Feature Flags

- `ENFORCE_WITHDRAW_SCOPE`
- `ENFORCE_SELLER_VERIFICATION`
- `BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY`
- `STRICT_PAYWALL_HUMAN_VALIDATION`
- `STRICT_CANONICAL_ORIGIN`
- `CRON_SINGLE_RUN_LOCK`

Flags should default to safe compatibility values in the first release that introduces them, then move to enforcement after telemetry confirms low/no legacy use.

## Verification Model

Each production release must pass:
- Targeted unit/integration tests for touched auth, payment, health, and cron paths.
- Full `npm test`.
- Manual staging smoke checks for login callback, listing creation, bot listing auth, purchase, withdraw, health, and one cron endpoint.
- Post-deploy log review for 30-60 minutes in a low-traffic window.

## Observability Requirements

- Log deprecated withdraw-scope usage with key id and owner id.
- Log unverified seller publish attempts with user id.
- Log guest account-bound purchase attempts with listing id and type.
- Log canonical-origin mismatches and rejected callback origins.
- Log cron lock contention if multiple schedulers attempt the same job.

## Non-Goals

- No immediate full marketplace workflow redesign.
- No destructive schema cleanup in the same release as enforcement.
- No frontend polish work before confirmed security/runtime fixes are live.
