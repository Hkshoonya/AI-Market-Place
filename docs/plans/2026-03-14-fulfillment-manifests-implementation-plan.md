# Fulfillment Manifests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add protocol-native fulfillment manifests with safe public listing previews, immutable order snapshots, and snapshot-first delivery while preserving compatibility with existing marketplace listings and orders.

**Architecture:** Introduce a normalized manifest builder in the marketplace layer, store preview manifests on listings and snapshot manifests on orders, then update preview, purchase, delivery, and order APIs to use the new contract while falling back to legacy listing-type behavior for older data.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, Vitest, Zod

---

### Task 1: Add the forward schema for preview and snapshot manifests

**Files:**
- Create: `supabase/migrations/043_add_marketplace_fulfillment_manifests.sql`
- Modify: `src/types/database.ts`
- Test: `src/lib/schemas/marketplace.test.ts`

**Step 1: Write the failing test**

Add a marketplace schema test that expects listing rows to accept `preview_manifest` and order rows to accept `fulfillment_manifest_snapshot`.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/schemas/marketplace.test.ts`
Expected: FAIL because the new fields are not yet accepted.

**Step 3: Write minimal implementation**

- add additive columns:
  - `marketplace_listings.preview_manifest jsonb`
  - `marketplace_orders.fulfillment_manifest_snapshot jsonb`
- update manual database types

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/schemas/marketplace.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/043_add_marketplace_fulfillment_manifests.sql src/types/database.ts src/lib/schemas/marketplace.test.ts
git commit -m "feat: add marketplace fulfillment manifest schema"
```

### Task 2: Add normalized manifest schemas and builders

**Files:**
- Create: `src/lib/marketplace/manifest.ts`
- Create: `src/lib/marketplace/manifest.test.ts`
- Modify: `src/lib/schemas/marketplace.ts`

**Step 1: Write the failing test**

Add tests for:
- preview manifest generation from `skill_manifest`
- preview manifest generation from `mcp_manifest`
- fallback preview generation from plain listing metadata
- snapshot manifest containing order/listing metadata

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/marketplace/manifest.test.ts`
Expected: FAIL because the builder does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- preview manifest schema
- snapshot manifest schema
- `buildListingPreviewManifest(...)`
- `buildOrderFulfillmentManifest(...)`
- conservative normalization helpers for capabilities, runtime, pricing, artifacts, and access

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/marketplace/manifest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketplace/manifest.ts src/lib/marketplace/manifest.test.ts src/lib/schemas/marketplace.ts
git commit -m "feat: add marketplace manifest builders"
```

### Task 3: Normalize listing create/update flows onto preview manifests

**Files:**
- Modify: `src/app/api/marketplace/listings/route.ts`
- Modify: `src/app/api/marketplace/listings/bot/route.ts`
- Modify: `src/app/api/marketplace/listings/[slug]/route.ts`
- Test: `src/app/api/marketplace/listings/route.test.ts`
- Test: `src/app/api/marketplace/listings/bot/route.test.ts`
- Test: `src/app/api/marketplace/listings/[slug]/route.test.ts`

**Step 1: Write the failing test**

Add tests that expect listing create/update to persist a normalized `preview_manifest` for:
- plain listing metadata
- `skill_manifest`
- `mcp_manifest`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts`
Expected: FAIL because routes do not yet write `preview_manifest`.

**Step 3: Write minimal implementation**

- accept optional explicit manifest input where appropriate
- build preview manifest at create/update time
- persist `preview_manifest`
- keep old manifest fields for compatibility

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/marketplace/listings/route.ts src/app/api/marketplace/listings/bot/route.ts src/app/api/marketplace/listings/[slug]/route.ts src/app/api/marketplace/listings/route.test.ts src/app/api/marketplace/listings/bot/route.test.ts src/app/api/marketplace/listings/[slug]/route.test.ts
git commit -m "feat: persist listing preview manifests"
```

### Task 4: Replace the narrow public manifest route with normalized previews

**Files:**
- Modify: `src/app/api/marketplace/listings/[slug]/manifest/route.ts`
- Create: `src/app/api/marketplace/listings/[slug]/manifest/route.test.ts`

**Step 1: Write the failing test**

Add tests that expect the route to:
- return normalized preview manifests for multiple listing types
- stop failing when only `preview_manifest` exists
- keep private snapshot-only fields out of the public response

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/marketplace/listings/[slug]/manifest/route.test.ts`
Expected: FAIL because the route only knows about `agent_config.skill_manifest`.

**Step 3: Write minimal implementation**

- load `preview_manifest` first
- fallback to normalized legacy sources
- return one consistent preview contract

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/marketplace/listings/[slug]/manifest/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/marketplace/listings/[slug]/manifest/route.ts src/app/api/marketplace/listings/[slug]/manifest/route.test.ts
git commit -m "feat: normalize public listing manifests"
```

### Task 5: Snapshot manifests onto orders during purchase and seller completion

**Files:**
- Modify: `src/lib/marketplace/purchase-handlers.ts`
- Modify: `src/app/api/marketplace/orders/[id]/route.ts`
- Test: `src/lib/marketplace/purchase-handlers.test.ts`
- Test: `src/app/api/marketplace/orders/[id]/route.test.ts`

**Step 1: Write the failing test**

Add tests that expect:
- auto-completed purchases to write `fulfillment_manifest_snapshot`
- seller-completed orders to write `fulfillment_manifest_snapshot`
- snapshot data to be immutable and derived from purchase-time listing state

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/marketplace/purchase-handlers.test.ts src/app/api/marketplace/orders/[id]/route.test.ts`
Expected: FAIL because no snapshot is written yet.

**Step 3: Write minimal implementation**

- build full manifest snapshot before delivery
- persist it on the order
- include purchase metadata and listing hash/version markers

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/marketplace/purchase-handlers.test.ts src/app/api/marketplace/orders/[id]/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketplace/purchase-handlers.ts src/app/api/marketplace/orders/[id]/route.ts src/lib/marketplace/purchase-handlers.test.ts src/app/api/marketplace/orders/[id]/route.test.ts
git commit -m "feat: snapshot fulfillment manifests on orders"
```

### Task 6: Make delivery snapshot-first with legacy fallback

**Files:**
- Modify: `src/lib/marketplace/delivery.ts`
- Modify: `src/lib/marketplace/delivery.test.ts`

**Step 1: Write the failing test**

Add tests that expect:
- snapshot-first delivery for manifest-enabled orders
- fallback to legacy listing-type logic when snapshot is absent
- account-bound protections still apply

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/marketplace/delivery.test.ts`
Expected: FAIL because delivery still reads listing details directly.

**Step 3: Write minimal implementation**

- read order snapshot first
- dispatch delivery from manifest `fulfillment_type`
- fallback to legacy listing-type handlers for older orders
- log fallback usage for future cleanup

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/marketplace/delivery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketplace/delivery.ts src/lib/marketplace/delivery.test.ts
git commit -m "feat: use fulfillment snapshots for delivery"
```

### Task 7: Add a private order-manifest endpoint

**Files:**
- Create: `src/app/api/marketplace/orders/[id]/manifest/route.ts`
- Create: `src/app/api/marketplace/orders/[id]/manifest/route.test.ts`

**Step 1: Write the failing test**

Add tests that expect:
- buyer can read order manifest
- seller can read order manifest
- admin can read order manifest
- unrelated user gets `403`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/marketplace/orders/[id]/manifest/route.test.ts`
Expected: FAIL because the endpoint does not exist.

**Step 3: Write minimal implementation**

- add the route
- authorize buyer/seller/admin only
- return `fulfillment_manifest_snapshot`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/marketplace/orders/[id]/manifest/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/marketplace/orders/[id]/manifest/route.ts src/app/api/marketplace/orders/[id]/manifest/route.test.ts
git commit -m "feat: add private order manifest endpoint"
```

### Task 8: Surface preview and purchased manifests in the UI

**Files:**
- Modify: `src/app/(marketplace)/marketplace/[slug]/page.tsx`
- Modify: `src/app/(auth)/orders/[id]/order-detail-content.tsx`
- Create: `src/components/marketplace/manifest-preview-card.tsx`
- Create: `src/components/marketplace/order-manifest-card.tsx`
- Test: `src/components/marketplace/manifest-preview-card.test.tsx`
- Test: `src/components/marketplace/order-manifest-card.test.tsx`

**Step 1: Write the failing test**

Add tests that expect:
- listing pages to render safe preview manifest information
- order detail pages to render purchased contract information
- empty states to explain when older orders have no manifest snapshot

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/marketplace/manifest-preview-card.test.tsx src/components/marketplace/order-manifest-card.test.tsx`
Expected: FAIL because the components do not exist.

**Step 3: Write minimal implementation**

- render the preview manifest panel on listing pages
- render purchased contract panel on order pages
- keep the UI concise and machine-readable

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/marketplace/manifest-preview-card.test.tsx src/components/marketplace/order-manifest-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/(marketplace)/marketplace/[slug]/page.tsx src/app/(auth)/orders/[id]/order-detail-content.tsx src/components/marketplace/manifest-preview-card.tsx src/components/marketplace/order-manifest-card.tsx src/components/marketplace/manifest-preview-card.test.tsx src/components/marketplace/order-manifest-card.test.tsx
git commit -m "feat: surface marketplace manifests in the UI"
```

### Task 9: Verify the full slice and mark the deferred item complete

**Files:**
- Modify: `supabase/migrations/044_mark_protocol_native_fulfillment_done.sql`
- Modify: `docs/plans/2026-03-14-fulfillment-manifests-design.md`
- Modify: `docs/plans/2026-03-14-fulfillment-manifests-implementation-plan.md`

**Step 1: Run focused verification**

Run:

```bash
npm test -- src/lib/marketplace/manifest.test.ts src/app/api/marketplace/listings/[slug]/manifest/route.test.ts src/lib/marketplace/purchase-handlers.test.ts src/lib/marketplace/delivery.test.ts src/app/api/marketplace/orders/[id]/route.test.ts src/app/api/marketplace/orders/[id]/manifest/route.test.ts src/components/marketplace/manifest-preview-card.test.tsx src/components/marketplace/order-manifest-card.test.tsx
```

Expected: PASS

**Step 2: Run build verification**

Run: `npm run build`
Expected: PASS

**Step 3: Apply or prepare forward SQL**

- add the deferred-ledger completion migration
- apply forward migrations to the connected database when credentials are present

**Step 4: Commit**

```bash
git add supabase/migrations/044_mark_protocol_native_fulfillment_done.sql docs/plans/2026-03-14-fulfillment-manifests-design.md docs/plans/2026-03-14-fulfillment-manifests-implementation-plan.md
git commit -m "docs: complete fulfillment manifest rollout plan"
```
