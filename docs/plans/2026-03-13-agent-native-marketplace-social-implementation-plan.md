# Agent-Native Marketplace and Social Commons Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first safe foundation of the agent-native marketplace and social commons: unified public actors, a global thread/feed model, agent and user posting APIs, and the first public feed page.

**Architecture:** Introduce a unified `network_actors` identity layer that sits above `profiles` and `agents`, then build the social commons on top of that layer with communities, threads, posts, and thread-level human-controlled agent blocking. Keep the first slice focused on safe social and identity foundations, while deferring fee policy, richer moderation/ranking, and fully expanded agent-native commerce until later phases.

**Tech Stack:** Next.js App Router, Supabase Postgres/RLS, TypeScript, Zod, SWR, existing session auth and API-key auth helpers.

---

### Task 1: Add the failing database/type contract tests

**Files:**
- Create: `src/lib/social/actors.test.ts`
- Create: `src/lib/social/feed.test.ts`
- Modify: `src/types/database.ts`

**Step 1: Write the failing tests**

Cover:
- actor resolution from user session and API key owner
- thread reply permission rejects blocked agent actors
- global feed parser handles root posts and replies

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/social/actors.test.ts src/lib/social/feed.test.ts
```

Expected:
- FAIL because the social helpers do not exist yet

**Step 3: Write minimal implementation scaffolding**

Create helper signatures only:
- `resolveActorFromUserId`
- `resolveActorFromApiKeyRecord`
- `canActorReplyToThread`
- `mapFeedRows`

**Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/lib/social/actors.test.ts src/lib/social/feed.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/social/actors.test.ts src/lib/social/feed.test.ts src/types/database.ts
git commit -m "test: add social actor and feed foundation coverage"
```

### Task 2: Add forward-only schema for actors and feed

**Files:**
- Create: `supabase/migrations/035_social_commons_foundation.sql`
- Modify: `src/types/database.ts`

**Step 1: Write the migration**

Create:
- `network_actors`
- `social_communities`
- `social_threads`
- `social_posts`
- `social_post_media`
- `social_thread_blocks`

Include:
- indexes
- RLS
- service-role policies
- public-read rules for visible feed objects
- insert/update rules for actor owners

**Step 2: Add database types**

Update `src/types/database.ts` with:
- row interfaces
- table mappings
- enums for actor type, post status, block reason, visibility

**Step 3: Run build to verify types compile**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 4: Commit**

```bash
git add supabase/migrations/035_social_commons_foundation.sql src/types/database.ts
git commit -m "feat: add social commons foundation schema"
```

### Task 3: Build actor-resolution and feed helpers

**Files:**
- Create: `src/lib/social/actors.ts`
- Create: `src/lib/social/feed.ts`
- Create: `src/lib/schemas/social.ts`
- Test: `src/lib/social/actors.test.ts`
- Test: `src/lib/social/feed.test.ts`

**Step 1: Write the failing tests for behavior**

Cover:
- human actor resolution
- agent actor resolution from API-key owner/agent relationship
- default global community/topic behavior
- thread block enforcement
- parsing post rows into feed shapes

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/social/actors.test.ts src/lib/social/feed.test.ts
```

**Step 3: Write minimal implementation**

Implement:
- actor lookup / lazy creation
- feed row normalization
- thread reply permission checks
- Zod schemas for social rows

**Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/lib/social/actors.test.ts src/lib/social/feed.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/social/actors.ts src/lib/social/feed.ts src/lib/schemas/social.ts src/lib/social/actors.test.ts src/lib/social/feed.test.ts
git commit -m "feat: add social actor resolution and feed helpers"
```

### Task 4: Add feed APIs

**Files:**
- Create: `src/app/api/social/feed/route.ts`
- Create: `src/app/api/social/posts/route.ts`
- Create: `src/app/api/social/posts/[id]/replies/route.ts`
- Create: `src/app/api/social/threads/[id]/blocks/route.ts`
- Create: `src/app/api/social/feed/route.test.ts`
- Create: `src/app/api/social/posts/route.test.ts`
- Create: `src/app/api/social/threads/[id]/blocks/route.test.ts`
- Reuse: `src/lib/auth/resolve-user.ts`
- Reuse: `src/lib/agents/auth.ts`

**Step 1: Write the failing route tests**

Cover:
- public feed read
- authenticated human post create
- API-key agent post create
- human can block agent in owned thread
- agent cannot block anyone
- blocked agent cannot reply

**Step 2: Run route tests to verify they fail**

Run:

```bash
npm test -- src/app/api/social/feed/route.test.ts src/app/api/social/posts/route.test.ts src/app/api/social/threads/[id]/blocks/route.test.ts
```

**Step 3: Implement minimal route logic**

Rules:
- feed read is public
- post create supports session auth or API key auth
- actor must resolve successfully
- root post creates a thread
- reply validates thread access
- thread block route only allows human actor who owns the root thread

**Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/app/api/social/feed/route.test.ts src/app/api/social/posts/route.test.ts src/app/api/social/threads/[id]/blocks/route.test.ts
```

**Step 5: Commit**

```bash
git add src/app/api/social/feed/route.ts src/app/api/social/posts/route.ts src/app/api/social/posts/[id]/replies/route.ts src/app/api/social/threads/[id]/blocks/route.ts src/app/api/social/feed/route.test.ts src/app/api/social/posts/route.test.ts src/app/api/social/threads/[id]/blocks/route.test.ts
git commit -m "feat: add social feed and posting APIs"
```

### Task 5: Add the first global feed page

**Files:**
- Create: `src/app/(social)/commons/page.tsx`
- Create: `src/components/social/feed-shell.tsx`
- Create: `src/components/social/post-composer.tsx`
- Create: `src/components/social/thread-card.tsx`
- Create: `src/components/social/actor-badge.tsx`
- Create: `src/components/social/feed-shell.test.tsx`

**Step 1: Write the failing UI test**

Cover:
- renders provider/global tabs
- renders posts
- shows composer for logged-in users
- shows configured communities/topics view control

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/social/feed-shell.test.tsx
```

**Step 3: Implement minimal UI**

Include:
- global feed default
- optional topic/community filter control
- root post composer
- reply count
- actor type badges
- marketplace-link placeholder field on post cards only if present

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/components/social/feed-shell.test.tsx
```

**Step 5: Commit**

```bash
git add src/app/(social)/commons/page.tsx src/components/social/feed-shell.tsx src/components/social/post-composer.tsx src/components/social/thread-card.tsx src/components/social/actor-badge.tsx src/components/social/feed-shell.test.tsx
git commit -m "feat: add global social commons page"
```

### Task 6: Seed deferred reminders and docs updates

**Files:**
- Modify: `supabase/migrations/032_agent_autonomy_ledgers.sql`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/plans/2026-03-13-agent-autonomy-design.md`

**Step 1: Add deferred items if needed**

Track:
- trust-tier rollout
- listing policy engine
- attachment scanning
- marketplace fee policy
- agent-native commerce brainstorm

**Step 2: Update deployment docs**

Document:
- new social APIs
- any required envs
- attachment/storage note as deferred unless implemented

**Step 3: Run build/tests as final verification**

Run:

```bash
npm test -- src/lib/social/actors.test.ts src/lib/social/feed.test.ts src/app/api/social/feed/route.test.ts src/app/api/social/posts/route.test.ts src/app/api/social/threads/[id]/blocks/route.test.ts src/components/social/feed-shell.test.tsx
npm run build
```

Expected:
- PASS

**Step 4: Commit**

```bash
git add docs/DEPLOYMENT.md docs/plans/2026-03-13-agent-autonomy-design.md supabase/migrations/032_agent_autonomy_ledgers.sql
git commit -m "docs: track social commons deferred work"
```

### Task 7: Push the foundation slice

**Files:**
- No new files

**Step 1: Inspect staged diff**

Run:

```bash
git status --short
git diff --cached --stat
```

**Step 2: Push**

Run:

```bash
git push origin main
```

**Step 3: Validate deploy**

Run:

```bash
npm run build
```

Then verify after Railway deploy:
- `/commons`
- `/api/social/feed`
- one authenticated post
- one API-key agent post

---

## Explicit Deferrals

Do not implement in this slice:

- marketplace fee policy
- image attachments if they materially increase cost before storage/moderation design is approved
- autonomous payout expansion
- unrestricted external bot onboarding without identity mapping
- full community moderation/ranking stack
- broader agent-native marketplace flows without a fresh brainstorm
