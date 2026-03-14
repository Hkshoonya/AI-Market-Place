# Public Data Trust and Commons Hero Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make public model data more trustworthy and understandable while upgrading the commons page with a proper hero and agentic motion.

**Architecture:** Add shared helpers for market-value explanation, description fallbacks, pricing/deployment truth labels, and lifecycle visibility, then wire those helpers into leaderboard, model detail, and commons surfaces. Keep methodology and sources available but hidden behind expandable panels.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Three.js client visual layer, Vitest.

---

### Task 1: Add shared trust/explanation helpers

**Files:**
- Create: `src/lib/models/market-value.ts`
- Modify: `src/lib/models/presentation.ts`
- Test: `src/lib/models/market-value.test.ts`

**Step 1: Write the failing tests**

Cover:
- market value display formats a dollar estimate
- confidence tier degrades when evidence is thin
- factor chips include adoption / monetization / distribution / confidence
- parameter presentation returns `Undisclosed` or `Estimated Range`

**Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/models/market-value.test.ts`

**Step 3: Implement minimal helper logic**

- Add `buildMarketValueExplanation(...)`
- Add compact and detailed market value display helpers
- Extend parameter presentation helpers where needed

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/models/market-value.test.ts`

**Step 5: Commit**

Run:
```bash
git add src/lib/models/market-value.ts src/lib/models/market-value.test.ts src/lib/models/presentation.ts
git commit -m "Add market value explanation helpers"
```

### Task 2: Improve generated model description structure

**Files:**
- Modify: `src/app/api/models/[slug]/description/route.ts`
- Modify: `src/lib/models/presentation.ts`
- Test: `src/app/api/models/[slug]/description/route.test.ts`

**Step 1: Write the failing tests**

Cover:
- fallback description returns structured fields, not only thin overview text
- generated summary exposes richer sections like `bestFor` and `tradeoffs`
- hidden methodology/source data is present in payload without polluting primary copy

**Step 2: Run the tests to verify they fail**

Run: `npm test -- src/app/api/models/[slug]/description/route.test.ts`

**Step 3: Implement minimal route and helper changes**

- Enrich fallback output
- Preserve truth labels between generated and source-backed content

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/api/models/[slug]/description/route.test.ts`

**Step 5: Commit**

Run:
```bash
git add src/app/api/models/[slug]/description/route.ts src/app/api/models/[slug]/description/route.test.ts src/lib/models/presentation.ts
git commit -m "Improve model description trust payloads"
```

### Task 3: Tighten deployment and pricing truth surfaces

**Files:**
- Modify: `src/lib/models/deployments.ts`
- Modify: `src/app/api/models/[slug]/deployments/route.ts`
- Modify: `src/app/(catalog)/models/[slug]/_components/pricing-tab.tsx`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx`
- Test: `src/lib/models/deployments.test.ts`

**Step 1: Write the failing tests**

Cover:
- direct deployments remain separate from related platforms
- related platforms include explicit reason text
- pricing tab distinguishes cheapest verified, official first-party, and related routes

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/models/deployments.test.ts`

**Step 3: Implement minimal truth-label changes**

- Add stronger reason labels and evidence tone
- Ensure related platforms are visually differentiated from direct deployments

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/models/deployments.test.ts`

**Step 5: Commit**

Run:
```bash
git add src/lib/models/deployments.ts src/lib/models/deployments.test.ts src/app/api/models/[slug]/deployments/route.ts src/app/(catalog)/models/[slug]/_components/pricing-tab.tsx src/app/(catalog)/models/[slug]/page.tsx
git commit -m "Clarify deployment and pricing trust levels"
```

### Task 4: Move and collapse tracked non-active models on leaderboards

**Files:**
- Modify: `src/app/(rankings)/leaderboards/page.tsx`
- Modify: `src/components/models/leaderboard-controls.tsx`
- Test: `src/components/models/leaderboard-controls.test.tsx`

**Step 1: Write the failing tests**

Cover:
- tracked non-active block is not rendered near the header by default
- the user can reveal it with a toggle

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/models/leaderboard-controls.test.tsx`

**Step 3: Implement minimal UI changes**

- Move tracked block to bottom of the page
- Add collapsed-by-default toggle

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/models/leaderboard-controls.test.tsx`

**Step 5: Commit**

Run:
```bash
git add src/app/(rankings)/leaderboards/page.tsx src/components/models/leaderboard-controls.tsx src/components/models/leaderboard-controls.test.tsx
git commit -m "Move non-active leaderboard tracking behind bottom toggle"
```

### Task 5: Add commons hero with auth/API CTA shell and motion

**Files:**
- Modify: `src/app/commons/page.tsx`
- Create: `src/components/social/commons-hero.tsx`
- Create: `src/components/social/commons-hero-scene.tsx`
- Test: `src/components/social/commons-hero.test.tsx`

**Step 1: Write the failing tests**

Cover:
- hero renders sign-in, sign-up, and API/agent CTAs
- hero copies differ for logged-out vs logged-in state where appropriate

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/social/commons-hero.test.tsx`

**Step 3: Implement minimal hero and motion shell**

- Add structured hero content
- Add lightweight client-only Three.js motion background
- Keep the feed loading path unaffected

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/social/commons-hero.test.tsx`

**Step 5: Commit**

Run:
```bash
git add src/app/commons/page.tsx src/components/social/commons-hero.tsx src/components/social/commons-hero-scene.tsx src/components/social/commons-hero.test.tsx
git commit -m "Add commons hero with agentic motion"
```

### Task 6: Wire market value explanations into public surfaces

**Files:**
- Modify: `src/app/(rankings)/leaderboards/page.tsx`
- Modify: `src/app/(catalog)/models/[slug]/_components/trading-tab.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/lib/models/market-value.test.ts`

**Step 1: Write/extend failing tests**

Cover:
- tables can render estimated market value cleanly
- detail surfaces expose richer explanation content behind expandable affordances

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/models/market-value.test.ts`

**Step 3: Implement minimal UI wiring**

- Use shared helper outputs on landing, leaderboards, and model detail
- Keep formula hidden while surfacing factors and confidence

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/models/market-value.test.ts`

**Step 5: Commit**

Run:
```bash
git add src/lib/models/market-value.ts src/lib/models/market-value.test.ts src/app/(rankings)/leaderboards/page.tsx src/app/(catalog)/models/[slug]/_components/trading-tab.tsx src/app/page.tsx
git commit -m "Wire market value explanations into public surfaces"
```

### Task 7: Final verification and push

**Files:**
- Review all touched files from Tasks 1-6

**Step 1: Run targeted tests**

Run:
```bash
npm test -- src/lib/models/market-value.test.ts src/app/api/models/[slug]/description/route.test.ts src/lib/models/deployments.test.ts src/components/models/leaderboard-controls.test.tsx src/components/social/commons-hero.test.tsx
```

**Step 2: Run full build**

Run:
```bash
npm run build
```

**Step 3: Run runtime checks**

Check:
- `/leaderboards`
- `/models/[slug]`
- `/api/models/[slug]/description`
- `/api/models/[slug]/deployments`
- `/commons`

**Step 4: Push final slice**

Run:
```bash
git push origin main
```
