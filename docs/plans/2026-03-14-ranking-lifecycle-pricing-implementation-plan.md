# Ranking Lifecycle and Pricing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make rankings lifecycle-aware, make leaderboard lenses functional, and make public pricing default to the cheapest verified route while preserving official and related context.

**Architecture:** Add shared lifecycle and pricing helpers first, then wire the URL-driven state into leaderboard and models pages, then update UI components to surface lifecycle and pricing truthfully. Keep schema changes additive and avoid changing score computation semantics unless needed for display correctness.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Vitest, Testing Library

---

### Task 1: Lock lifecycle and pricing behavior with failing tests

**Files:**
- Create: `src/lib/models/lifecycle.test.ts`
- Modify: `src/lib/models/pricing.test.ts`
- Modify: `src/components/models/leaderboard-lens-nav.test.tsx`
- Modify: `src/components/models/leaderboard-controls.test.tsx`

**Step 1: Write the failing tests**

- Add tests for:
  - filtering `active` vs `all`
  - marking deprecated/preview models as non-ranked by default
  - choosing the cheapest verified price
  - lens cards emitting URL-driven active state

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/models/lifecycle.test.ts src/lib/models/pricing.test.ts src/components/models/leaderboard-lens-nav.test.tsx src/components/models/leaderboard-controls.test.tsx`

**Step 3: Implement the minimal helpers/props to satisfy the failures**

**Step 4: Run the same tests to verify they pass**

**Step 5: Commit**

```bash
git add src/lib/models/lifecycle.test.ts src/lib/models/pricing.test.ts src/components/models/leaderboard-lens-nav.test.tsx src/components/models/leaderboard-controls.test.tsx
git commit -m "test: lock lifecycle and pricing ranking behavior"
```

### Task 2: Add shared lifecycle and pricing helpers

**Files:**
- Create: `src/lib/models/lifecycle.ts`
- Modify: `src/lib/models/pricing.ts`
- Modify: `src/lib/models/deployments.ts`

**Step 1: Write the failing tests**

- If needed, extend Task 1 tests to cover helper return shapes.

**Step 2: Run targeted tests to verify failures**

Run: `npm test -- src/lib/models/lifecycle.test.ts src/lib/models/pricing.test.ts`

**Step 3: Write minimal implementation**

- Add lifecycle groups, badges, and inclusion helpers.
- Add verified price summary helpers and direct/related deployment explanation helpers.

**Step 4: Run targeted tests**

Run: `npm test -- src/lib/models/lifecycle.test.ts src/lib/models/pricing.test.ts`

**Step 5: Commit**

```bash
git add src/lib/models/lifecycle.ts src/lib/models/pricing.ts src/lib/models/deployments.ts
git commit -m "feat: add lifecycle and verified pricing helpers"
```

### Task 3: Wire leaderboard and models URL state

**Files:**
- Modify: `src/app/(rankings)/leaderboards/page.tsx`
- Modify: `src/app/(rankings)/leaderboards/[category]/page.tsx`
- Modify: `src/app/(catalog)/models/page.tsx`
- Modify: `src/components/models/leaderboard-lens-nav.tsx`
- Modify: `src/components/models/leaderboard-controls.tsx`
- Modify: `src/components/models/leaderboard-explorer.tsx`
- Modify: `src/components/models/models-filter-bar.tsx`

**Step 1: Write the failing tests**

- Add/extend component tests for active lens and lifecycle toggle behavior.

**Step 2: Run targeted tests to verify failures**

Run: `npm test -- src/components/models/leaderboard-lens-nav.test.tsx src/components/models/leaderboard-controls.test.tsx`

**Step 3: Implement minimal URL-state behavior**

- Read `lens` and `lifecycle` from `searchParams`.
- Pass them into server/client components.
- Ensure main and category pages follow the same lifecycle filter.

**Step 4: Run targeted tests**

Run: `npm test -- src/components/models/leaderboard-lens-nav.test.tsx src/components/models/leaderboard-controls.test.tsx`

**Step 5: Commit**

```bash
git add src/app/(rankings)/leaderboards/page.tsx src/app/(rankings)/leaderboards/[category]/page.tsx src/app/(catalog)/models/page.tsx src/components/models/leaderboard-lens-nav.tsx src/components/models/leaderboard-controls.tsx src/components/models/leaderboard-explorer.tsx src/components/models/models-filter-bar.tsx
git commit -m "feat: wire lifecycle-aware leaderboard and models filters"
```

### Task 4: Surface lifecycle and pricing truth in model/detail UI

**Files:**
- Modify: `src/components/models/models-grid.tsx`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx`
- Modify: `src/app/(catalog)/models/[slug]/_components/pricing-tab.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Write the failing tests**

- Add tests for lifecycle badges and cheapest-vs-official pricing summaries.

**Step 2: Run targeted tests to verify failures**

Run: `npm test -- src/lib/models/pricing.test.ts`

**Step 3: Implement minimal UI changes**

- Show non-active lifecycle badges.
- Show cheapest verified price in tables.
- Show cheapest/official/other verified route summaries in detail pricing view.
- Keep homepage market leaders active-only.

**Step 4: Run targeted tests**

Run: `npm test -- src/lib/models/pricing.test.ts`

**Step 5: Commit**

```bash
git add src/components/models/models-grid.tsx src/app/(catalog)/models/[slug]/page.tsx src/app/(catalog)/models/[slug]/_components/pricing-tab.tsx src/app/page.tsx
git commit -m "feat: surface lifecycle and verified pricing in public model views"
```

### Task 5: Verify the slice end to end

**Files:**
- No new source files required unless a regression appears

**Step 1: Run targeted tests**

Run: `npm test -- src/lib/models/lifecycle.test.ts src/lib/models/pricing.test.ts src/components/models/leaderboard-lens-nav.test.tsx src/components/models/leaderboard-controls.test.tsx`

**Step 2: Run the full build**

Run: `npm run build`

**Step 3: Do functional verification**

Check:
- `/leaderboards?lens=capability`
- `/leaderboards?lens=popularity&lifecycle=all`
- `/leaderboards/agentic_browser?lifecycle=all`
- `/models?lifecycle=all`
- one active model detail page
- one deprecated/preview model detail page

**Step 4: Commit**

```bash
git add .
git commit -m "chore: verify lifecycle-aware rankings and pricing presentation"
```
