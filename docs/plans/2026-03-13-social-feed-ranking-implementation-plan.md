# Social Feed Ranking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reputation-weighted feed modes to the commons and fix the removed-root query gap so moderated tombstones remain visible in live feed results.

**Architecture:** Extend the existing social feed helper to support `top`, `latest`, and `trusted` modes. Keep ranking deterministic in application code using recent thread candidates, root actor trust/reputation, recency, and engagement. Wire the mode through the API, page search params, and commons UI filters.

**Tech Stack:** Next.js App Router, TypeScript, Supabase public client, existing social feed helpers, Vitest.

---

### Task 1: Add failing ranking and tombstone tests

**Files:**
- Modify: `src/lib/social/feed.test.ts`
- Modify: `src/app/api/social/feed/route.test.ts`
- Modify: `src/components/social/social-feed-view.test.tsx`

**Step 1: Write the failing tests**

Cover:
- `top` ranks a trusted/high-reputation actor above a newer low-trust actor when candidates are close
- `latest` preserves chronological order
- removed root posts remain eligible as tombstones in feed shaping
- feed route forwards `mode` to the feed helper
- commons UI renders mode tabs/links

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/social/feed.test.ts src/app/api/social/feed/route.test.ts src/components/social/social-feed-view.test.tsx
```

Expected:
- FAIL because ranking modes do not exist yet

**Step 3: Write minimal implementation**

Add only:
- feed-mode types
- ranking helper stubs
- route param plumbing stubs

**Step 4: Run tests to verify they pass**

Run the same command.

**Step 5: Commit**

```bash
git add src/lib/social/feed.test.ts src/app/api/social/feed/route.test.ts src/components/social/social-feed-view.test.tsx
git commit -m "test: add social feed ranking coverage"
```

### Task 2: Implement deterministic feed scoring

**Files:**
- Modify: `src/lib/social/feed.ts`

**Step 1: Implement ranking helpers**

Add:
- feed mode type
- trust-tier score helper
- recency score helper
- engagement score helper
- `scoreThreadForMode`

**Step 2: Fix removed-root eligibility**

Update root-post fetching so removed roots are still loaded and mapped into tombstones.

**Step 3: Apply scoring in listPublicFeed**

For `top` and `trusted`:
- fetch recent candidates
- load actors with `reputation_score`
- rank in memory
- slice to requested limit

For `latest`:
- keep simple chronological order

**Step 4: Run targeted tests**

Run:

```bash
npm test -- src/lib/social/feed.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/social/feed.ts src/lib/social/feed.test.ts
git commit -m "feat: add deterministic social feed scoring"
```

### Task 3: Wire mode through API and page

**Files:**
- Modify: `src/app/api/social/feed/route.ts`
- Modify: `src/app/commons/page.tsx`

**Step 1: Read and validate `mode`**

Supported:
- `top`
- `latest`
- `trusted`

Default:
- `top`

**Step 2: Pass mode into feed helper**

Ensure:
- API supports mode query param
- page search params support mode
- community filter and mode can coexist

**Step 3: Run targeted route tests**

Run:

```bash
npm test -- src/app/api/social/feed/route.test.ts
```

**Step 4: Commit**

```bash
git add src/app/api/social/feed/route.ts src/app/commons/page.tsx src/app/api/social/feed/route.test.ts
git commit -m "feat: add social feed mode plumbing"
```

### Task 4: Add mode UI to commons

**Files:**
- Modify: `src/components/social/social-feed-view.tsx`
- Modify: `src/components/social/social-feed-view.test.tsx`

**Step 1: Render mode pills**

Add:
- `Top`
- `Latest`
- `Trusted`

Preserve:
- existing community filters
- current hero and stats

**Step 2: Link modes through URL params**

Community and mode should both survive navigation.

**Step 3: Run component tests**

Run:

```bash
npm test -- src/components/social/social-feed-view.test.tsx
```

**Step 4: Commit**

```bash
git add src/components/social/social-feed-view.tsx src/components/social/social-feed-view.test.tsx
git commit -m "feat: add social feed mode controls"
```

### Task 5: Verify and document

**Files:**
- Modify: `docs/plans/2026-03-13-social-feed-ranking-design.md`
- Modify: `docs/plans/2026-03-13-social-feed-ranking-implementation-plan.md`

**Step 1: Run focused tests**

Run:

```bash
npm test -- src/lib/social/feed.test.ts src/app/api/social/feed/route.test.ts src/components/social/social-feed-view.test.tsx
```

**Step 2: Run build**

Run:

```bash
npm run build
```

**Step 3: Update deferred notes**

Record that:
- feed ranking is done
- personalized/discovery ranking remains deferred

**Step 4: Commit**

```bash
git add docs/plans/2026-03-13-social-feed-ranking-design.md docs/plans/2026-03-13-social-feed-ranking-implementation-plan.md
git commit -m "docs: finalize social feed ranking rollout notes"
```
