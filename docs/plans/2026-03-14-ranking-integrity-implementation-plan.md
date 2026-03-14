# Ranking Integrity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Repair duplicate arena/category/ranking bugs and ship a clearer, evidence-weighted ranking model with capability, popularity, adoption, value, and economic-footprint semantics.

**Architecture:** Normalize arena and category taxonomy at the data/read layer first, then surface the corrected taxonomy in leaderboard/model UI, then add the new adoption/economic-footprint semantics as compatibility-preserving derived fields. Keep current public APIs working while expanding them with clearer ranking metadata.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Vitest, SWR

---

### Task 1: Lock the Current Failure Cases

**Files:**
- Modify: `src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx`
- Modify: `src/components/models/leaderboard-controls.test.tsx`
- Create: `src/lib/scoring/popularity-score.test.ts`
- Create: `src/lib/scoring/economic-footprint.test.ts`

**Step 1: Write the failing tests**

- Add a model-page test proving duplicate raw arena names collapse into one canonical `Chatbot Arena` family.
- Add a leaderboard-controls test proving `Browser Agents`, `Embeddings`, `Speech & Audio`, and `Capability` are visible with canonical labels.
- Add a popularity-score test proving mixed community/adoption/durability inputs produce stable ordering.
- Add an economic-footprint test proving high-adoption low-price models can outrank weakly adopted expensive models.

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx" "src/components/models/leaderboard-controls.test.tsx" "src/lib/scoring/popularity-score.test.ts" "src/lib/scoring/economic-footprint.test.ts"
```

Expected:

- Failures for missing canonical arena grouping, incorrect leaderboard labels, and missing/new scoring helpers.

**Step 3: Write minimal implementation**

- Only add enough scaffolding to make the tests target real code paths.

**Step 4: Run tests to verify the failures are the intended ones**

Run the same command and confirm failures are about missing behavior, not test/setup errors.

**Step 5: Commit**

```bash
git add "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx" "src/components/models/leaderboard-controls.test.tsx" "src/lib/scoring/popularity-score.test.ts" "src/lib/scoring/economic-footprint.test.ts"
git commit -m "test: lock ranking integrity regressions"
```

### Task 2: Canonicalize Arena Families

**Files:**
- Create: `src/lib/models/arena-family.ts`
- Modify: `src/app/(catalog)/models/[slug]/_components/benchmarks-tab.tsx`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx`
- Test: `src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx`

**Step 1: Write/extend the failing test**

- Assert that arena rows with different raw names but the same canonical family render once at the top level.
- Assert that variant rows remain available as subtext or nested detail.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx"
```

**Step 3: Write minimal implementation**

- Add a canonical arena-family helper.
- Group raw `elo_ratings` by canonical family before rendering.
- Update summary `bestElo` selection to prefer canonical top-level family display.

**Step 4: Run tests**

```bash
npm test -- "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx"
```

**Step 5: Commit**

```bash
git add src/lib/models/arena-family.ts "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.tsx" "src/app/(catalog)/models/[slug]/page.tsx" "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.test.tsx"
git commit -m "feat: canonicalize arena families on model pages"
```

### Task 3: Repair Leaderboard Taxonomy

**Files:**
- Modify: `src/components/models/leaderboard-controls.tsx`
- Modify: `src/app/(rankings)/leaderboards/page.tsx`
- Modify: `src/components/models/leaderboard-explorer.tsx`
- Test: `src/components/models/leaderboard-controls.test.tsx`

**Step 1: Write/extend the failing test**

- Assert canonical category labels and keys are used.
- Assert `Capability` is promoted in the main leaderboard navigation/controls.

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/models/leaderboard-controls.test.tsx
```

**Step 3: Write minimal implementation**

- Replace ambiguous labels with canonical public labels.
- Align control keys to real enums.
- Promote capability lens visibility in the main page structure.

**Step 4: Run tests**

```bash
npm test -- src/components/models/leaderboard-controls.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/models/leaderboard-controls.tsx src/app/(rankings)/leaderboards/page.tsx src/components/models/leaderboard-explorer.tsx src/components/models/leaderboard-controls.test.tsx
git commit -m "feat: repair leaderboard taxonomy and capability surfacing"
```

### Task 4: Extract Popularity Semantics

**Files:**
- Create: `src/lib/scoring/popularity-score.ts`
- Modify: `src/lib/scoring/market-cap-calculator.ts`
- Modify: `src/lib/compute-scores/compute-all-lenses.ts`
- Test: `src/lib/scoring/popularity-score.test.ts`

**Step 1: Write/extend the failing test**

- Assert popularity combines community attention, market attention, observed adoption, and durability.
- Assert transient spikes cannot fully dominate durable traction.

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/scoring/popularity-score.test.ts
```

**Step 3: Write minimal implementation**

- Move popularity logic into a dedicated module.
- Keep compatibility exports where existing callers expect them.
- Make popularity component groups explicit and reusable.

**Step 4: Run tests**

```bash
npm test -- src/lib/scoring/popularity-score.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/scoring/popularity-score.ts src/lib/scoring/market-cap-calculator.ts src/lib/compute-scores/compute-all-lenses.ts src/lib/scoring/popularity-score.test.ts
git commit -m "refactor: extract explicit popularity scoring semantics"
```

### Task 5: Add Adoption And Economic Footprint

**Files:**
- Create: `src/lib/scoring/economic-footprint.ts`
- Modify: `src/lib/compute-scores/types.ts`
- Modify: `src/lib/compute-scores/fetch-inputs.ts`
- Modify: `src/lib/compute-scores/compute-all-lenses.ts`
- Modify: `src/lib/compute-scores/persist-results.ts`
- Modify: `src/types/database.ts`
- Create: `supabase/migrations/042_add_adoption_and_economic_footprint.sql`
- Test: `src/lib/scoring/economic-footprint.test.ts`

**Step 1: Write/extend the failing test**

- Assert adoption and economic-footprint scores penalize low evidence.
- Assert high-distribution, durable models outrank thin expensive models.

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/scoring/economic-footprint.test.ts
```

**Step 3: Write minimal implementation**

- Add `adoption_score`.
- Add `economic_footprint_score` and `economic_footprint_rank`.
- Persist new fields compatibly.
- Add forward migration only; do not rewrite old migrations.

**Step 4: Run tests**

```bash
npm test -- src/lib/scoring/economic-footprint.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/scoring/economic-footprint.ts src/lib/compute-scores/types.ts src/lib/compute-scores/fetch-inputs.ts src/lib/compute-scores/compute-all-lenses.ts src/lib/compute-scores/persist-results.ts src/types/database.ts supabase/migrations/042_add_adoption_and_economic_footprint.sql src/lib/scoring/economic-footprint.test.ts
git commit -m "feat: add adoption and economic footprint scoring"
```

### Task 6: Surface Evidence And Explanations

**Files:**
- Modify: `src/app/(catalog)/models/[slug]/_components/benchmarks-tab.tsx`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx`
- Modify: `src/components/models/leaderboard-explorer.tsx`
- Modify: `src/app/(rankings)/leaderboards/page.tsx`
- Create: `src/components/models/evidence-summary.tsx`
- Test: `src/components/models/evidence-summary.test.tsx`

**Step 1: Write the failing test**

- Assert thin models show `Insufficient Coverage`.
- Assert model pages expose evidence summary text.
- Assert leaderboard surfaces explain economic-footprint/popularity semantics.

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/models/evidence-summary.test.tsx
```

**Step 3: Write minimal implementation**

- Add evidence-summary component.
- Show coverage depth, arena family count, benchmark family count, and uncertainty copy.
- Add concise explainer text/tooltips for popularity and economic footprint.

**Step 4: Run tests**

```bash
npm test -- src/components/models/evidence-summary.test.tsx
```

**Step 5: Commit**

```bash
git add "src/app/(catalog)/models/[slug]/_components/benchmarks-tab.tsx" "src/app/(catalog)/models/[slug]/page.tsx" src/components/models/leaderboard-explorer.tsx src/app/(rankings)/leaderboards/page.tsx src/components/models/evidence-summary.tsx src/components/models/evidence-summary.test.tsx
git commit -m "feat: surface ranking evidence and uncertainty states"
```

### Task 7: Verify End-To-End Ranking Integrity

**Files:**
- Modify: `src/app/api/rankings/route.test.ts`
- Modify: `src/app/api/models/[slug]/description/route.test.ts`
- Modify: `src/app/(rankings)/leaderboards/page.test.tsx`
- Modify: `docs/plans/2026-03-14-ranking-integrity-design.md`

**Step 1: Write the failing tests**

- Assert rankings API returns the new ranking fields without breaking current consumers.
- Assert leaderboard page renders Browser Agents and Capability.
- Assert model-page arena families are deduplicated through the real page path.

**Step 2: Run tests to verify they fail**

```bash
npm test -- "src/app/api/rankings/route.test.ts" "src/app/(rankings)/leaderboards/page.test.tsx"
```

**Step 3: Write minimal implementation**

- Finish any API/page glue still missing from earlier tasks.
- Update docs if the public metric copy changed during calibration.

**Step 4: Run full verification**

```bash
npm test
npm run build
```

**Step 5: Commit**

```bash
git add "src/app/api/rankings/route.test.ts" "src/app/(rankings)/leaderboards/page.test.tsx" docs/plans/2026-03-14-ranking-integrity-design.md
git commit -m "test: verify ranking integrity end to end"
```

Plan complete and saved to `docs/plans/2026-03-14-ranking-integrity-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints
