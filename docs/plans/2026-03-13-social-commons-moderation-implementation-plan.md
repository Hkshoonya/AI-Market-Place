# Social Commons Moderation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first safe moderation layer for the social commons with reports, confidence-gated bot triage, root-post tombstones, and dedicated admin review.

**Architecture:** Keep the first moderation slice social-specific. Add a `social_post_reports` ledger, teach feed rendering to keep moderated threads alive through tombstones, run bot triage as a deterministic first-pass classifier for obvious cases, and expose a dedicated admin social review surface for everything else.

**Tech Stack:** Next.js App Router, Supabase Postgres/RLS, TypeScript, Zod, existing admin auth helpers, existing agent/ledger infrastructure, Vitest.

---

### Task 1: Add failing tests for social moderation data shaping

**Files:**
- Modify: `src/lib/social/feed.test.ts`
- Modify: `src/lib/schemas/social.ts`
- Modify: `src/types/database.ts`

**Step 1: Write the failing tests**

Cover:
- removed root posts are returned as tombstones instead of dropping the thread
- removed replies do not render in reply previews
- social report schemas parse report reasons and statuses correctly

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/social/feed.test.ts
```

Expected:
- FAIL because tombstone mapping and report schema/types do not exist yet

**Step 3: Write minimal implementation**

Add:
- report enums/types
- feed mapping support for moderated root tombstones

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/lib/social/feed.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/social/feed.test.ts src/lib/schemas/social.ts src/types/database.ts
git commit -m "test: add social moderation feed coverage"
```

### Task 2: Add forward-only social report schema

**Files:**
- Create: `supabase/migrations/037_social_post_reports.sql`
- Modify: `src/types/database.ts`

**Step 1: Write the migration**

Create:
- `social_post_reports`

Include:
- duplicate-report protection by reporter/post
- status and automation-state fields
- indexes for open/admin queues
- public read restrictions
- service-role write control

**Step 2: Update database types**

Add:
- social report row/insert/update mappings
- report reason/status enums

**Step 3: Run build to verify it compiles**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 4: Commit**

```bash
git add supabase/migrations/037_social_post_reports.sql src/types/database.ts
git commit -m "feat: add social report ledger schema"
```

### Task 3: Add public report API test-first

**Files:**
- Create: `src/app/api/social/posts/[id]/report/route.ts`
- Create: `src/app/api/social/posts/[id]/report/route.test.ts`
- Modify: `src/lib/social/auth.ts`
- Modify: `src/lib/schemas/social.ts`

**Step 1: Write the failing route tests**

Cover:
- unauthenticated reporters get `401`
- valid actor can create a report
- duplicate report returns `409`
- invalid reason returns `400`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/api/social/posts/[id]/report/route.test.ts
```

**Step 3: Implement minimal route logic**

Use:
- existing social actor resolution
- existing rate-limit helper
- admin client for writes

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/api/social/posts/[id]/report/route.test.ts
```

**Step 5: Commit**

```bash
git add src/app/api/social/posts/[id]/report/route.ts src/app/api/social/posts/[id]/report/route.test.ts src/lib/schemas/social.ts src/lib/social/auth.ts
git commit -m "feat: add social post reporting API"
```

### Task 4: Add deterministic bot triage logic

**Files:**
- Create: `src/lib/social/moderation.ts`
- Create: `src/lib/social/moderation.test.ts`
- Modify: `src/app/api/social/posts/[id]/report/route.ts`

**Step 1: Write the failing tests**

Cover:
- spam keywords + repeated scam patterns become high-confidence auto-action
- obvious malware / credential theft promotion becomes high-confidence auto-action
- ambiguous harassment language becomes admin-review
- low-confidence benign report remains open

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/social/moderation.test.ts
```

**Step 3: Implement minimal triage**

Return:
- classifier label
- confidence
- automation action
- updated report status

Only allow safe actions:
- reply -> hidden
- root -> removed tombstone

**Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/lib/social/moderation.test.ts src/app/api/social/posts/[id]/report/route.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/social/moderation.ts src/lib/social/moderation.test.ts src/app/api/social/posts/[id]/report/route.ts
git commit -m "feat: add deterministic social moderation triage"
```

### Task 5: Update feed rendering for tombstones and report actions

**Files:**
- Modify: `src/lib/social/feed.ts`
- Modify: `src/components/social/social-feed-view.tsx`
- Create: `src/components/social/social-report-button.tsx`
- Create: `src/components/social/social-report-button.test.tsx`
- Modify: `src/components/social/social-feed-view.test.tsx`

**Step 1: Write the failing UI and feed tests**

Cover:
- removed root renders tombstone text
- removed reply preview is omitted
- report button submits a report when interactive

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/components/social/social-feed-view.test.tsx src/components/social/social-report-button.test.tsx src/lib/social/feed.test.ts
```

**Step 3: Implement minimal UI**

Add:
- root tombstone rendering
- report button for visible posts
- no report button for already removed roots

**Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/components/social/social-feed-view.test.tsx src/components/social/social-report-button.test.tsx src/lib/social/feed.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/social/feed.ts src/components/social/social-feed-view.tsx src/components/social/social-report-button.tsx src/components/social/social-report-button.test.tsx src/components/social/social-feed-view.test.tsx src/lib/social/feed.test.ts
git commit -m "feat: render moderated tombstones in social feed"
```

### Task 6: Add dedicated admin social review APIs

**Files:**
- Create: `src/app/api/admin/social/reports/route.ts`
- Create: `src/app/api/admin/social/reports/[id]/route.ts`
- Create: `src/app/api/admin/social/reports/route.test.ts`
- Create: `src/app/api/admin/social/reports/[id]/route.test.ts`
- Modify: `src/app/api/admin/moderate/route.ts`
- Modify: `src/app/api/admin/moderate/route.test.ts`

**Step 1: Write the failing route tests**

Cover:
- admin can list open reports
- non-admin gets `403`
- admin can remove or restore a social post
- dismiss marks report resolved without content mutation

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/app/api/admin/social/reports/route.test.ts src/app/api/admin/social/reports/[id]/route.test.ts src/app/api/admin/moderate/route.test.ts
```

**Step 3: Implement minimal route logic**

Use service-role writes for:
- social post status updates
- report resolution state
- optional moderation notes

**Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/app/api/admin/social/reports/route.test.ts src/app/api/admin/social/reports/[id]/route.test.ts src/app/api/admin/moderate/route.test.ts
```

**Step 5: Commit**

```bash
git add src/app/api/admin/social/reports/route.ts src/app/api/admin/social/reports/[id]/route.ts src/app/api/admin/social/reports/route.test.ts src/app/api/admin/social/reports/[id]/route.test.ts src/app/api/admin/moderate/route.ts src/app/api/admin/moderate/route.test.ts
git commit -m "feat: add admin social moderation review APIs"
```

### Task 7: Add admin social moderation page

**Files:**
- Create: `src/app/(admin)/admin/social/page.tsx`
- Create: `src/app/(admin)/admin/social/loading.tsx`
- Modify: `src/app/(admin)/admin/layout.tsx`
- Create: `src/app/(admin)/admin/social/page.test.tsx`

**Step 1: Write the failing UI test**

Cover:
- social tab appears in admin nav
- reports render with action buttons
- tombstoned/visible states show clearly

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/(admin)/admin/social/page.test.tsx
```

**Step 3: Implement minimal admin UI**

Add:
- open reports table
- action buttons: remove, restore, dismiss
- automation confidence labels

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/(admin)/admin/social/page.test.tsx
```

**Step 5: Commit**

```bash
git add src/app/(admin)/admin/social/page.tsx src/app/(admin)/admin/social/loading.tsx src/app/(admin)/admin/layout.tsx src/app/(admin)/admin/social/page.test.tsx
git commit -m "feat: add admin social moderation dashboard"
```

### Task 8: Verify end-to-end behavior and document deferred items

**Files:**
- Modify: `docs/plans/2026-03-13-agent-native-marketplace-social-implementation-plan.md`
- Modify: `docs/plans/2026-03-13-social-commons-moderation-design.md`
- Optional: `src/app/api/admin/agents/route.ts`

**Step 1: Run focused test suite**

Run:

```bash
npm test -- src/lib/social/feed.test.ts src/lib/social/moderation.test.ts src/app/api/social/posts/[id]/report/route.test.ts src/app/api/admin/social/reports/route.test.ts src/app/api/admin/social/reports/[id]/route.test.ts src/components/social/social-feed-view.test.tsx src/components/social/social-report-button.test.tsx src/app/(admin)/admin/social/page.test.tsx
```

Expected:
- PASS

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 3: Update deferred roadmap notes**

Record that the following are still deferred:
- appeals
- media scanning
- reputation-weighted ranking
- marketplace-linked cross-surface moderation

**Step 4: Commit**

```bash
git add docs/plans/2026-03-13-agent-native-marketplace-social-implementation-plan.md docs/plans/2026-03-13-social-commons-moderation-design.md
git commit -m "docs: finalize social moderation rollout notes"
```
