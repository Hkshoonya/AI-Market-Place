# Marketplace Dual Settlement And Contact Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship dual settlement marketplace behavior, connected seller-facing contact notifications, and a more explanatory animated marketplace experience without regressing current commerce flows.

**Architecture:** Add explicit settlement-mode and fee-policy presentation helpers first, wire contact submissions and listing inquiries into persistent notification-capable records second, then rebuild the marketplace top section into a clearer explanatory hero with an existing Three.js foundation. Keep admin visibility read-oriented and avoid introducing admin notification spam.

**Tech Stack:** Next.js App Router, TypeScript, React, Three.js/react-three-fiber, Supabase, Vitest, Playwright, SWR

---

### Task 1: Baseline Current Marketplace And Contact Surfaces

**Files:**
- Review: `src/app/(marketplace)/marketplace/page.tsx`
- Review: `src/app/(static)/contact/contact-content.tsx`
- Review: `src/app/api/contact/route.ts`
- Review: `src/components/marketplace/contact-form.tsx`
- Review: `src/app/api/notifications/route.ts`

**Step 1: Extract current contact/marketplace behavior**

Run:
```bash
rg -n "contact|notification|fee|wallet|marketplace" "src/app/(marketplace)" "src/app/(static)/contact" src/components/marketplace src/app/api/contact src/app/api/notifications
```

Expected: concrete file map for the current marketplace landing, contact route, and notification surfaces.

**Step 2: Record target files in this plan**

Update this plan if new exact files are required during implementation.

---

### Task 2: Settlement Mode And Fee Policy Helpers

**Files:**
- Create: `src/lib/marketplace/settlement.ts`
- Create: `src/lib/marketplace/settlement.test.ts`
- Modify: `src/lib/constants/marketplace.ts`

**Step 1: Write the failing tests**

Add tests covering:
- direct settlement labels/copy
- assisted escrow labels/copy
- current public `0% platform fee for now` messaging
- future internal assisted-fee configuration support

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- "src/lib/marketplace/settlement.test.ts"
```

Expected: failure because settlement helpers do not exist yet.

**Step 3: Write minimal implementation**

Add a helper layer that exposes:
- settlement mode metadata
- public fee copy
- internal future-fee config compatibility

**Step 4: Run tests**

Run:
```bash
npm test -- "src/lib/marketplace/settlement.test.ts"
```

Expected: pass.

---

### Task 3: Connect Contact Submission Routing And Seller Notifications

**Files:**
- Modify: `src/app/api/contact/route.ts`
- Review/Modify: `src/components/marketplace/contact-form.tsx`
- Review: `src/app/api/notifications/route.ts`
- Create: `src/app/api/contact/route.test.ts`
- If needed, modify: `src/types/database.ts`

**Step 1: Write failing route tests**

Add tests for:
- generic contact submission persists successfully
- listing/seller-targeted submission creates a notification for the listed seller
- admin is not notified by default
- malformed or missing seller target is handled safely

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- "src/app/api/contact/route.test.ts"
```

Expected: failures for missing routing/notification behavior.

**Step 3: Write minimal implementation**

Update the contact route to:
- accept optional listing/seller context
- persist the submission
- notify the listed seller user when applicable
- keep admin access as audit visibility only

**Step 4: Run tests**

Run:
```bash
npm test -- "src/app/api/contact/route.test.ts"
```

Expected: pass.

---

### Task 4: Make Marketplace Contact UI Context-Aware

**Files:**
- Modify: `src/components/marketplace/contact-form.tsx`
- Modify: `src/app/(static)/contact/contact-content.tsx`
- Create: `src/components/marketplace/contact-form.test.tsx`
- Create or modify: `src/app/(static)/contact/contact-content.test.tsx`

**Step 1: Write failing component tests**

Cover:
- seller/listing context is passed through to the API payload when present
- success copy reflects connected communications
- error states remain readable

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- "src/components/marketplace/contact-form.test.tsx" "src/app/(static)/contact/contact-content.test.tsx"
```

Expected: failures for missing payload/context behavior.

**Step 3: Write minimal implementation**

Update the forms to:
- carry seller/listing context where appropriate
- explain that the listed seller will receive the inquiry
- keep the generic contact page as a broader support path

**Step 4: Run tests**

Run the same command and confirm pass.

---

### Task 5: Rebuild Marketplace Hero And Explainer Blocks

**Files:**
- Modify: `src/app/(marketplace)/marketplace/page.tsx`
- Create: `src/components/marketplace/marketplace-hero-scene.tsx`
- Create: `src/components/marketplace/marketplace-mode-explainer.tsx`
- Create: `src/components/marketplace/marketplace-hero-scene.test.tsx`
- Create: `src/app/(marketplace)/marketplace/page.test.tsx`
- Review: `src/components/three/ambient-scene.tsx`
- Review: `src/components/three/neural-network-scene.tsx`

**Step 1: Write failing tests**

Add tests proving:
- marketplace hero explains direct vs assisted flows
- `0% platform fee for now` appears
- user/agent settlement choice framing is visible
- aligned explainer blocks render with the intended headings

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- "src/app/(marketplace)/marketplace/page.test.tsx" "src/components/marketplace/marketplace-hero-scene.test.tsx"
```

Expected: failures for missing new hero/explainer content.

**Step 3: Write minimal implementation**

Build:
- a lightweight client-side Three.js hero using the existing three-component patterns
- a set of aligned explainer cards for direct settlement, assisted escrow, tracking, and current fee posture
- clearer CTA hierarchy above listings

**Step 4: Run tests**

Run the same command and confirm pass.

---

### Task 6: Propagate Dual-Settlement Explanations Into Marketplace Touchpoints

**Files:**
- Review/Modify: `src/components/marketplace/purchase-button.tsx`
- Review/Modify: `src/components/marketplace/purchase-success.tsx`
- Review/Modify: `src/app/(auth)/wallet/wallet-content.tsx`
- Review/Modify: `src/app/(marketplace)/marketplace/[slug]/page.tsx`
- Add/modify tests adjacent to changed components

**Step 1: Identify the minimum touchpoints**

Only update the places where users need policy clarity during checkout, post-purchase, or wallet funding.

**Step 2: Add failing tests first**

Add targeted tests for any changed components before modifying them.

**Step 3: Implement minimal policy-copy propagation**

Repeat the approved model:
- direct wallet settlement keeps custody with the parties
- assisted escrow routes through platform mediation
- current public fee posture remains `0% platform fee for now`

**Step 4: Run targeted tests**

Run only the changed component tests first.

---

### Task 7: Admin Visibility Without Admin Notification Spam

**Files:**
- Review: `src/app/api/notifications/route.ts`
- Review: `src/app/(admin)/**/*contact*`
- Modify/create only if needed after Task 3

**Step 1: Confirm data visibility model**

Ensure contact/inquiry records remain inspectable by admin through data access or admin UI, but do not emit per-sale/per-contact admin notifications.

**Step 2: Add tests only if behavior changes**

If notification targeting logic needs explicit proof, add narrow tests around recipient selection.

**Step 3: Implement minimal hardening**

Keep admin audit access, avoid admin noise.

---

### Task 8: Verification

**Files:**
- Verify all modified files above

**Step 1: Run focused tests**

Run the targeted test commands added in prior tasks.

**Step 2: Run the broader suite**

Run:
```bash
npm test
```

Expected: all tests pass.

**Step 3: Run the build**

Run:
```bash
npm run build
```

Expected: build exits `0`.

**Step 4: Browser verification**

Use Playwright to verify:
- marketplace hero/explainer content renders
- contact form submits
- seller-facing notification path or stored-contact evidence is visible where feasible

**Step 5: Update roadmap docs**

Modify:
- `docs/plans/2026-03-19-roadmap-audit-status.md`
- `docs/plans/2026-03-19-plan-matrix.md`
- `docs/plans/2026-03-19-roadmap-closeout-implementation-plan.md`

Reflect the newly closed or narrowed gaps with concrete evidence.
