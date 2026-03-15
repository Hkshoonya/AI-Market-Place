# Access Offers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a shared access-offers layer and launch a homepage `Top Subscription Providers` table that ranks subscription products by user value and trust while keeping partner-supported links secondary.

**Architecture:** Build a pure access-offers helper over existing `deployment_platforms`, `model_deployments`, and `models` data. Reuse that helper on the homepage first, then add compact summaries on other public surfaces without duplicating ranking logic. Keep testing focused on ranking, CTA selection, and label integrity.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Zod, Vitest

---

### Task 1: Write the access-offers ranking helper

**Files:**
- Create: `src/lib/models/access-offers.ts`
- Test: `src/lib/models/access-offers.test.ts`

**Step 1: Write failing tests**

Cover:
- ranking prefers higher-value cheaper trusted subscriptions
- CTA label selection (`Subscribe`, `Start Free Trial`, `Get API Access`, `Deploy`)
- partner-supported disclosure stays separate from CTA label
- best-for summary is derived from covered categories/models

**Step 2: Run tests to verify failure**

Run: `npm test -- src/lib/models/access-offers.test.ts`

**Step 3: Implement the helper**

Add:
- shared types for platform, deployment, model, and ranked offer
- score calculation
- CTA label calculation
- action URL resolution
- partner disclosure text

**Step 4: Run tests to verify pass**

Run: `npm test -- src/lib/models/access-offers.test.ts`

### Task 2: Add homepage subscription table

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/home/top-subscription-providers.tsx`
- Test: `src/components/home/top-subscription-providers.test.tsx`

**Step 1: Write the failing component test**

Cover:
- renders ranked offers
- shows monthly price
- uses action-first CTAs
- shows partner-supported disclosure separately

**Step 2: Implement homepage data flow**

- fetch platforms, deployments, and necessary model metrics in parallel
- build ranked offers with the shared helper
- render the table on the homepage

**Step 3: Verify**

Run:
- `npm test -- src/components/home/top-subscription-providers.test.tsx`
- `npm run build`

### Task 3: Reuse access-offer summaries on provider/model/skills pages

**Files:**
- Modify: `src/app/(catalog)/providers/[slug]/page.tsx`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx`
- Modify: `src/app/(catalog)/skills/page.tsx`

**Step 1: Add compact summaries**

- provider pages: provider access posture
- model pages: best access paths summary
- skills page: capability-area access context

**Step 2: Keep pages distinct**

- provider pages stay provider-centric
- model pages stay model-centric
- skills page stays discovery-centric

**Step 3: Verify**

Run:
- targeted tests if new helpers/components are introduced
- `npm run build`

### Task 4: Final verification

**Files:**
- Modify if needed based on failures from earlier tasks

**Step 1: Run targeted tests**

Run:
- `npm test -- src/lib/models/access-offers.test.ts src/components/home/top-subscription-providers.test.tsx`

**Step 2: Run full build**

Run:
- `npm run build`

**Step 3: Commit**

```bash
git add docs/plans/2026-03-14-access-offers-design.md docs/plans/2026-03-14-access-offers-implementation-plan.md src/lib/models/access-offers.ts src/lib/models/access-offers.test.ts src/components/home/top-subscription-providers.tsx src/components/home/top-subscription-providers.test.tsx src/app/page.tsx src/app/(catalog)/providers/[slug]/page.tsx src/app/(catalog)/models/[slug]/page.tsx src/app/(catalog)/skills/page.tsx
git commit -m "Add shared access offers and subscription rankings"
```

