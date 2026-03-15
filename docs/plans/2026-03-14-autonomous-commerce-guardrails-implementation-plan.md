# Autonomous Commerce Guardrails Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand marketplace trust rails so content risk and autonomy risk are enforced separately, allowing legitimate human/manual purchases where appropriate while blocking unsafe or illegal autonomous execution.

**Architecture:** Extend the existing marketplace policy engine and review ledger with richer risk outputs, then apply those outputs consistently in listing create/update, purchase enforcement, and admin listing visibility. Keep compatibility with the current `allow/review/block` semantics while adding human-vs-agent purchase distinctions.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, Vitest

---

### Task 1: Add failing policy-engine tests for dual-axis risk

**Files:**
- Modify: `src/lib/marketplace/policy.test.ts`

**Step 1: Write the failing test**

Add tests for:
- illegal content blocks everyone
- suspicious content stays in review
- manifest-missing legitimate listings become `manual_only`
- trusted manifest-backed listings stay `autonomous_allowed`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/marketplace/policy.test.ts`
Expected: FAIL because the policy result does not yet expose the richer fields.

**Step 3: Write minimal implementation**

Update the policy model with:
- `contentRiskLevel`
- `autonomyRiskLevel`
- `purchaseMode`
- `autonomyMode`
- `reasonCodes`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/marketplace/policy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketplace/policy.test.ts src/lib/marketplace/policy.ts
git commit -m "feat: expand marketplace policy model"
```

### Task 2: Add forward schema for richer review and policy fields

**Files:**
- Create: `supabase/migrations/045_expand_marketplace_policy_modes.sql`
- Modify: `src/types/database.ts`

**Step 1: Write the failing test**

Add or extend tests that expect the new listing-policy fields and autonomous policy options to exist in the type/schema surface used by marketplace code.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/marketplace/policy.test.ts`
Expected: FAIL or type mismatch until the new fields exist.

**Step 3: Write minimal implementation**

Additive schema only:
- extend `listing_policy_reviews`
- extend `autonomous_commerce_policies`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/marketplace/policy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/045_expand_marketplace_policy_modes.sql src/types/database.ts
git commit -m "feat: add richer marketplace policy fields"
```

### Task 3: Enforce human-vs-agent purchase distinctions

**Files:**
- Modify: `src/lib/marketplace/purchase-handlers.test.ts`
- Modify: `src/lib/marketplace/purchase-handlers.ts`
- Modify: `src/app/api/marketplace/purchase/route.ts` only if response mapping needs adjustment

**Step 1: Write the failing test**

Add tests for:
- human session purchase allowed on `manual_only`
- API-key purchase blocked on `manual_only`
- all purchases blocked on content `review` / `block`
- autonomous purchase blocked when manifest-backed delivery is required and unavailable

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/marketplace/purchase-handlers.test.ts`
Expected: FAIL because current purchase enforcement does not distinguish these cases.

**Step 3: Write minimal implementation**

Use the richer policy result to:
- block all purchase for content review/block
- allow session purchase for `manual_only`
- deny API-key purchase for `manual_only` / restricted autonomy

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/marketplace/purchase-handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketplace/purchase-handlers.test.ts src/lib/marketplace/purchase-handlers.ts src/app/api/marketplace/purchase/route.ts
git commit -m "feat: enforce human and agent purchase modes"
```

### Task 4: Persist richer policy summaries during listing create/update

**Files:**
- Modify: `src/app/api/marketplace/listings/route.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.ts`
- Modify: `src/app/api/marketplace/listings/[slug]/route.ts`
- Modify: `src/app/api/marketplace/listings/route.test.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.test.ts`
- Modify: `src/app/api/marketplace/listings/[slug]/route.test.ts`

**Step 1: Write the failing test**

Add assertions that policy review records include the richer modes and reason codes.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts`
Expected: FAIL because the richer fields are not yet persisted.

**Step 3: Write minimal implementation**

Persist richer policy output through `syncListingPolicyReview(...)` and keep current draft/paused compatibility.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/marketplace/listings/route.ts src/app/api/marketplace/listings/bot/route.ts src/app/api/marketplace/listings/[slug]/route.ts src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts src/lib/marketplace/policy.ts
git commit -m "feat: persist richer listing policy results"
```

### Task 5: Expand admin listing visibility

**Files:**
- Modify: `src/app/api/admin/listings/route.ts`
- Modify: `src/app/api/admin/listings/route.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- `content_risk_level`
- `autonomy_risk_level`
- `purchase_mode`
- `autonomy_mode`
- `reason_codes`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/admin/listings/route.test.ts`
Expected: FAIL because admin output only includes the older summary.

**Step 3: Write minimal implementation**

Map the latest policy review into the richer operator summary.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/admin/listings/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/admin/listings/route.ts src/app/api/admin/listings/route.test.ts
git commit -m "feat: surface richer marketplace policy summaries"
```

### Task 6: Mark deferred items done after DB apply and verification

**Files:**
- Create: `supabase/migrations/046_mark_marketplace_guardrails_expanded_done.sql`

**Step 1: Apply forward migration**

Apply:
- `045_expand_marketplace_policy_modes.sql`
- `046_mark_marketplace_guardrails_expanded_done.sql`

**Step 2: Verify remote state**

Confirm:
- new policy fields exist
- relevant deferred items are `done`

**Step 3: Commit**

```bash
git add supabase/migrations/046_mark_marketplace_guardrails_expanded_done.sql
git commit -m "docs: mark expanded marketplace guardrails complete"
```

### Task 7: Full verification

**Files:**
- Modify only if verification exposes regressions

**Step 1: Run focused tests**

Run:

```bash
npm test -- src/lib/marketplace/policy.test.ts src/lib/marketplace/purchase-handlers.test.ts src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts src/app/api/admin/listings/route.test.ts
```

Expected: PASS

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS

**Step 3: Commit**

```bash
git add .
git commit -m "feat: expand autonomous commerce guardrails"
```
