# Roadmap Closeout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining roadmap items marked partial by finishing production-risk verification and hardening first, then completing the product-depth trust, ranking, and maintainability closure work.

**Architecture:** Execute in two waves. Phase 1 focuses on live-runtime proof, auth and commerce hardening, Supabase/Auth verification, and any missing enforcement or regression coverage. Phase 2 focuses on public-data-trust closure, ranking-integrity proof, autonomy/maintainability follow-through, and final roadmap status updates grounded in fresh evidence.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Playwright, Supabase, Railway, SMTP-backed Supabase Auth

## Current Status Snapshot

- Phase 1 runtime proof is materially stronger than the original roadmap audit implied:
  - live `/api/health` is healthy on Railway
  - live `/api/pipeline/health` is healthy
  - `cron_runs` shows active recent jobs
  - direct Supabase reads against `models`, `data_sources`, `pipeline_health`, and auth admin access are working
- Remote Supabase security hardening completed:
  - `052_enable_pipeline_health_rls.sql` applied successfully
- Remote Supabase auth remediation completed:
  - removed the legacy `on_auth_user_confirm_email` trigger via `053_remove_auth_auto_confirm_trigger.sql`
  - hardened auth/profile trigger functions with explicit `search_path` and schema-qualified writes via `054_harden_auth_trigger_functions.sql`
  - updated live auth config so `site_url` is `https://aimarketcap.tech`
  - updated auth redirect allow-list for production and localhost callback/reset flows
  - SMTP-backed confirmation and recovery flows are working again
  - temporary `mailer_autoconfirm` fallback has been removed
- Browser-verified live auth status:
  - password signup works again
  - login works
  - `/admin` loads
  - `/admin` survives refresh
  - sign-out clears session
- Honest remaining Phase 1 blockers:
  - production wallet provisioning still returns `201` with null deposit addresses, which indicates the live release is behind the current local wallet guardrails and/or production chain infra is still not configured

---

### Task 1: Baseline the Remaining Partial Roadmap Items

**Files:**
- Review: `docs/plans/2026-03-19-plan-matrix.md`
- Review: `docs/plans/2026-03-19-roadmap-audit-status.md`
- Review: `docs/plans/2026-03-12-audit-fix-plan.md`
- Review: `docs/plans/2026-03-12-live-remediation-rollout-plan.md`
- Review: `docs/plans/2026-03-13-autonomous-maintainability-plan.md`
- Review: `docs/plans/2026-03-14-autonomous-commerce-guardrails-implementation-plan.md`
- Review: `docs/plans/2026-03-14-public-data-trust-implementation-plan.md`
- Review: `docs/plans/2026-03-14-ranking-integrity-implementation-plan.md`

**Step 1: Extract concrete unresolved claims**

Run:
```bash
rg -n "partial|open|still|remaining|verify|verification|proof|runtime|legacy|guardrail|trust|integrity" docs/plans
```
Expected: a concrete list of unresolved verification and hardening gaps.

**Step 2: Separate Phase 1 and Phase 2 work**

Classify gaps into:
- Phase 1: production/runtime/auth/commerce/operator proof
- Phase 2: public-data-trust, ranking-integrity, maintainability/autonomy closure

**Step 3: Save the closure map**

Update this plan with any newly discovered file paths needed for implementation or verification.

---

### Task 2: Phase 1 Live Runtime And Supabase Verification

**Files:**
- Review: `src/app/api/health/route.ts`
- Review: `src/app/api/pipeline/health/route.ts`
- Review: `src/lib/cron-runtime.ts`
- Review: `src/lib/cron-tracker.ts`
- Review: `src/lib/supabase/admin.ts`
- Review: `src/lib/supabase/client.ts`
- Review: `src/components/auth/auth-provider.tsx`
- Review: `docs/DEPLOYMENT.md`

**Step 1: Verify live release metadata**

Run:
```bash
curl -sS https://aimarketcap.tech/api/health
```
Expected: healthy/degraded payload with Railway metadata and current commit evidence.

**Step 2: Verify public pipeline health**

Run:
```bash
curl -sS https://aimarketcap.tech/api/pipeline/health
```
Expected: valid summary payload with non-error status.

**Step 3: Verify Supabase connectivity directly**

Use service-role and anon clients from `.env.local` to confirm:
- `models`
- `data_sources`
- `pipeline_health`
- `cron_runs`
- auth admin access

Expected: readable data and no schema/auth regression after the Supabase transfer.

**Step 4: Verify authenticated/internal cron evidence**

Query `cron_runs` and related health tables directly using service-role access.

Expected:
- recent runs exist
- no evidence of runtime disconnect between public health and real cron state

**Step 5: Record evidence**

Write the observed runtime/cron/Supabase status into the roadmap status docs if healthy, or create focused bug tasks if not.

---

### Task 3: Phase 1 Auth, SMTP, And Session Verification

**Files:**
- Review: `src/app/auth/callback/route.ts`
- Review: `src/lib/constants/site.ts`
- Review: `src/lib/supabase/client.ts`
- Review: `src/components/auth/auth-provider.tsx`
- Review: `src/components/auth/auth-button.tsx`
- Review: `src/app/(auth)/login/*`
- Review: `src/app/(auth)/forgot-password/*`
- Review: `src/app/(auth)/reset-password/*`

**Step 1: Write or refine failing auth/browser tests where gaps are missing**

Add or update tests for:
- session restoration after callback
- sign-out path
- password reset path if present
- callback canonical origin handling

**Step 2: Verify real browser auth behavior**

Use Playwright against local and/or live environments to confirm:
- login callback completes
- session survives refresh
- sign-out clears session
- auth-dependent profile/admin surfaces load

**Step 3: Verify SMTP-backed auth path**

If the active flow relies on magic links or password reset email:
- confirm email flow is accepted by Supabase
- verify redirect handling and resulting session behavior

**Step 4: Patch only verified auth defects**

If failures are observed, implement minimal fixes plus regression coverage before moving on.

---

### Task 4: Phase 1 Final Commerce Edge Audit

**Files:**
- Review: `src/app/api/marketplace/purchase/route.ts`
- Review: `src/lib/marketplace/purchase-handlers.ts`
- Review: `src/app/api/marketplace/orders/[id]/route.ts`
- Review: `src/app/api/marketplace/orders/[id]/manifest/route.ts`
- Review: `src/app/api/marketplace/orders/[id]/messages/route.ts`
- Review: `src/app/api/marketplace/auctions/*`
- Review: `src/lib/marketplace/auctions/*`
- Review: `src/app/api/seller/withdraw/route.ts`
- Review: `src/app/(auth)/wallet/*`

**Step 1: Identify remaining legacy/manual edge cases**

Focus on:
- auctions settlement failure behavior
- withdrawal failure/refund behavior
- wallet provisioning and access
- guest/auth parity on older non-primary purchase paths
- manifest and message access controls

**Step 2: Add failing tests first**

Write focused tests only for the remaining uncovered edge cases discovered in Step 1.

**Step 3: Implement minimal hardening**

Patch the verified gaps without broad refactors.

**Step 4: Verify**

Run targeted tests, then:
```bash
npm test
npm run build
```

---

### Task 5: Phase 1 Closure And Documentation

**Files:**
- Modify: `docs/plans/2026-03-19-roadmap-audit-status.md`
- Modify: `docs/plans/2026-03-19-plan-matrix.md`

**Step 1: Mark what is now actually closed**

Update the partial items whose verification or hardening gaps are now resolved.

**Step 2: Leave honest residual risks**

If anything remains partial, document the exact unclosed operator/runtime dependency instead of vague wording.

---

### Task 6: Phase 2 Public-Data-Trust Closure

**Files:**
- Review: `src/app/page.tsx`
- Review: `src/app/(catalog)/models/[slug]/page.tsx`
- Review: `src/app/(rankings)/leaderboards/page.tsx`
- Review: `src/components/models/market-value-badge.tsx`
- Review: `src/app/(catalog)/providers/*`
- Review: `src/app/(catalog)/skills/*`
- Review: `src/components/shared/data-freshness-badge.tsx`
- Review: `src/lib/models/market-value.ts`
- Review: `src/lib/models/presentation.ts`

**Step 1: Identify unfinished trust surfaces**

Check whether all intended explanation/freshness/truth labels are present and consistent on:
- home
- model detail
- leaderboards
- providers
- skills

**Step 2: Add failing tests for missing trust behaviors**

Add regression tests before patching any missing surfaces.

**Step 3: Implement the missing trust affordances**

Patch only the verified gaps.

**Step 4: Verify**

Run targeted component/page tests and a browser smoke pass of the public trust surfaces.

---

### Task 7: Phase 2 Ranking-Integrity Closure

**Files:**
- Review: `src/app/api/rankings/route.ts`
- Review: `src/app/(rankings)/leaderboards/*`
- Review: `src/lib/models/public-families.ts`
- Review: `src/lib/constants/categories.ts`
- Review: `src/lib/models/lifecycle.ts`
- Review: `src/lib/models/pricing.ts`

**Step 1: Re-audit the remaining integrity concerns**

Confirm whether any of these still need explicit closure:
- duplicate or alias family collapse
- taxonomy/category consistency
- lifecycle-aware ranking visibility
- cheapest verified pricing consistency
- explanatory proof on ranking surfaces

**Step 2: Add failing tests**

Only for the gaps that still reproduce.

**Step 3: Implement minimal integrity fixes**

Patch and re-verify.

---

### Task 8: Phase 2 Maintainability/Autonomy Follow-Through

**Files:**
- Review: `src/lib/agents/*`
- Review: `src/app/api/cron/agents/*`
- Review: `src/app/(admin)/admin/agents/*`
- Review: `src/lib/agents/residents/*`

**Step 1: Identify the still-partial unattended-repair gaps**

Focus on:
- stale task cleanup
- escalation visibility
- narrow playbook coverage
- operator review clarity

**Step 2: Add tests and patch the highest-signal missing playbooks or operator affordances**

Prefer bounded improvements with clear verification over broad autonomy expansion.

**Step 3: Verify**

Run targeted tests and authenticated admin/operator checks where feasible.

---

### Task 9: Final Closure Pass

**Files:**
- Modify: `docs/plans/2026-03-19-plan-matrix.md`
- Modify: `docs/plans/2026-03-19-roadmap-audit-status.md`
- Modify: `docs/plans/2026-03-19-roadmap-closeout-implementation-plan.md`

**Step 1: Full verification**

Run:
```bash
npm test
npm run build
```

**Step 2: Browser verification**

Run Playwright smoke checks against the key public and authenticated surfaces touched in both phases.

**Step 3: Close or narrow remaining partial items**

Mark completed items as `done` with evidence. For anything not completed, write the precise blocking reason and residual risk.
