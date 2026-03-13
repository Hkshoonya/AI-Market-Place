# Live Remediation Rollout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the audited security, runtime, and marketplace issues in production-safe slices with test-first changes and compatibility windows for breaking behavior.

**Architecture:** The work is sequenced as five releases. Release 1 closes the confirmed low-blast-radius exploit paths. Releases 2-4 introduce compatibility scaffolding, stabilize cron/runtime behavior, and then enforce the new contracts. Release 5 removes deprecated paths and hardens the remaining infra and frontend surfaces.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase, Railway Docker deployment, Cloudflare, external cron.

---

### Task 1: Rollout Docs and Source of Truth

**Files:**
- Create: `docs/plans/2026-03-12-live-remediation-rollout-design.md`
- Create: `docs/plans/2026-03-12-live-remediation-rollout-plan.md`
- Review: `docs/DEPLOYMENT.md`
- Review: `railway.json`
- Review: `Dockerfile`
- Review: `scripts/cron-jobs.sh`

**Step 1: Confirm deployment assumptions**

Run:
```bash
rg -n "Railway|Dockerfile|cron|health|SITE_URL" docs railway.json Dockerfile scripts server
```
Expected: evidence of the live Railway runtime plus the external cron contract.

**Step 2: Save the approved rollout design**

Document the five-release strategy, feature flags, rollback model, and observability requirements.

**Step 3: Save the execution plan**

Document the exact task order below and the verification expectation for each task.

---

### Task 2: Release 1 Test Coverage

**Files:**
- Modify: `src/app/api/health/__tests__/route.test.ts`
- Create: `src/lib/middleware/api-paywall.test.ts`
- Create: `src/app/api/marketplace/listings/bot/route.test.ts`
- Create: `src/app/api/marketplace/listings/[slug]/pricing/route.test.ts`
- Create: `src/app/auth/callback/route.test.ts`

**Step 1: Write failing tests for the silent clamps**

Add tests that prove:
- DB failure returns `503` from `/api/health`
- fake `sb-*` cookies do not get human classification
- expired API keys are rejected on bot listing create/update
- expired API keys are rejected on pricing updates
- auth callback redirects to configured canonical origin, not request origin

**Step 2: Run only the new/changed tests**

Run:
```bash
npm test -- src/app/api/health/__tests__/route.test.ts src/lib/middleware/api-paywall.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/pricing/route.test.ts src/app/auth/callback/route.test.ts
```
Expected: FAIL for the new cases before implementation.

---

### Task 3: Release 1 Silent Clamps

**Files:**
- Create: `supabase/migrations/016_fix_deployment_rls_policies.sql`
- Modify: `src/lib/agents/auth.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.ts`
- Modify: `src/app/api/marketplace/listings/[slug]/pricing/route.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/lib/middleware/api-paywall.ts`
- Modify: `src/middleware.ts`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/lib/constants/site.ts`

**Step 1: Add the RLS repair migration**

Create a single `016_*` migration that drops the broken `USING (true)` policies from migration `007` and recreates them with `auth.role() = 'service_role'`.

**Step 2: Reuse shared API-key auth on bot routes**

Replace inline key validation with `authenticateApiKey(...)` so `expires_at` is enforced consistently.

**Step 3: Return truthful health status**

Remove the `200` rewrite on DB failure and return the `503` response produced by `pingDb()`.

**Step 4: Validate human paywall classification**

Treat a request as human only if a real Supabase session can be resolved, not just because a cookie name starts with `sb-`.

**Step 5: Canonicalize redirects**

Use a shared canonical origin helper based on `NEXT_PUBLIC_SITE_URL` for:
- `www` to apex redirect logic
- auth callback redirects
- site metadata URL fallback

**Step 6: Run the targeted tests again**

Run the same command from Task 2.
Expected: PASS.

**Step 7: Run the full suite**

Run:
```bash
npm test
npm run lint
```
Expected: PASS.

---

### Task 4: Release 2 Compatibility Scaffolding

**Files:**
- Modify: `src/app/api/seller/withdraw/route.ts`
- Modify: `src/app/api/api-keys/route.ts`
- Modify: `src/app/api/marketplace/listings/route.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.ts`
- Modify: `src/lib/marketplace/purchase-handlers.ts`
- Create: `src/lib/runtime-flags.ts`
- Create: `src/lib/deprecation-log.ts`

**Step 1: Write failing tests**

Add tests for:
- new `withdraw` scope support
- legacy-scope deprecation logging
- unverified seller listing creation logging
- guest account-bound purchase logging path

**Step 2: Add runtime flags and structured deprecation logging**

Implement small helpers so enforcement can be switched on later without deleting compatibility code.

**Step 3: Add compatibility behavior**

- Accept `withdraw` scope immediately.
- Continue allowing legacy withdraw scopes only when the enforcement flag is off.
- Keep seller creation path compatible but log unverified publishing.
- Keep guest account-bound purchase path observable but not yet blocked when the block flag is off.

**Step 4: Verify targeted tests, then full suite**

Run the changed tests first, then `npm test`.

---

### Task 5: Release 3 Runtime Stabilization

**Files:**
- Modify: `server/custom-server.js`
- Modify: `server/cron-schedule.js`
- Modify: `scripts/cron-jobs.sh`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/lib/cron-tracker.ts`
- Create: `src/lib/cron-lock.ts`
- Add migrations as needed after reconciling numbering

**Step 1: Write failing tests around cron entry behavior**

Cover lock acquisition and duplicate-run rejection at the cron route or helper level.

**Step 2: Implement a real lock or single-scheduler cutover**

Prefer a DB-backed advisory lock/helper over an app-memory guard. Keep compatibility until production confirms the external cron path is authoritative.

**Step 3: Remove fake cron-health reporting**

Either wire real state into health or remove the misleading fields from the detailed response.

**Step 4: Reconcile migration prerequisites**

Fix numbering and add only the schema work needed for reliable new migrations.

**Step 5: Verify**

Run targeted cron/health tests, then `npm test`.

---

### Task 6: Release 4 Enforcement

**Files:**
- Modify: `src/app/api/seller/withdraw/route.ts`
- Modify: `src/app/api/marketplace/listings/route.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.ts`
- Modify: `src/lib/marketplace/purchase-handlers.ts`
- Modify: `src/types/database.ts`
- Add migrations only if moderated listing status or schema support is required

**Step 1: Write failing enforcement tests**

Cover:
- withdrawals rejected without dedicated scope when enforcement is on
- seller listing publish rejected or downgraded when seller is unverified and enforcement is on
- guest auto-delivery blocked for `api_access` and `agent`

**Step 2: Implement enforcement behind flags**

Use the compatibility scaffolding from Task 4; do not mix schema invention and enforcement blindly.

**Step 3: Fix price-sort correctness**

Correct the `"price"` sort in `src/app/(catalog)/models/page.tsx` using a real field or an explicit fallback strategy based on actual schema support.

**Step 4: Verify**

Run targeted tests, then `npm test` and `npm run lint`.

---

### Task 7: Release 5 Hardening and Cleanup

**Files:**
- Modify: `next.config.ts`
- Modify: `src/lib/rate-limit.ts`
- Add/update related tests
- Add migration/regression coverage for RLS and schema reproducibility

**Step 1: Write failing tests where practical**

At minimum add regression coverage for:
- RLS expectations
- durable rate-limit behavior fallback logic
- CSP production config generation

**Step 2: Tighten CSP**

Remove `'unsafe-eval'` from production builds only.

**Step 3: Add durable rate limiting**

Introduce a production-safe backend with a dev/test fallback; do not make production depend on an unconfigured service.

**Step 4: Remove deprecated paths**

Only after compatibility logs show the old paths are no longer used.

**Step 5: Final verification**

Run:
```bash
npm run lint
npm test
```
Expected: PASS, with targeted manual staging checks recorded separately.
