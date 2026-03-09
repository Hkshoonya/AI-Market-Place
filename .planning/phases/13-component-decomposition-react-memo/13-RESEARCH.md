# Phase 13: Component Decomposition + React.memo - Research

**Researched:** 2026-03-08
**Domain:** React component architecture, performance optimization, memoization
**Confidence:** HIGH

## Summary

Phase 13 addresses 8 oversized components across the codebase. Three are page-level components in `src/app/` (model detail at 878 lines, compare client at 718 lines, settings form at 681 lines) and five are in `src/components/` (ranking-weight-controls at 517, rank-timeline at 501, search-dialog at 485, models-filter-bar at 470, leaderboard-explorer at 457 lines). All must be decomposed below 300 lines. Additionally, React.memo must be applied to expensive pure sub-components identified during decomposition.

This project has successful precedent from Phase 5 (v1.0) which decomposed 4 mega-components using the pattern: extract sub-components into sibling files + extract stateful logic into custom hooks in `src/hooks/`. That same pattern applies here. The React Compiler is NOT enabled in this project (no `reactCompiler` in next.config.ts), so React.memo provides genuine re-render optimization. React version is 19.2.3, which fully supports `React.memo`.

**Primary recommendation:** Follow the established Phase 5 decomposition pattern -- extract JSX sections into co-located sub-component files and stateful logic into custom hooks. Apply React.memo to leaf sub-components that receive stable primitive/memoized props and are expensive to render (chart wrappers, table rows, filter panels). Verify all 170+ existing tests plus 5 component tests pass after each decomposition.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DECOMP-01 | Model detail page (878 lines) decomposed into focused sub-components | Server component; tab content sections are natural split points (benchmarks, pricing, trading, trends, news, details, changelog tabs + header + stats row). No hooks needed -- pure JSX extraction. |
| DECOMP-02 | Compare client (709 lines) decomposed into focused sub-components | Client component with ModelSelector (already inline ~97 lines) and ComparisonRow (already inline ~40 lines). Extract comparison table sections (overview, benchmarks, pricing, visual) into sub-components. |
| DECOMP-03 | Settings form (681 lines) decomposed into focused sub-components | Client component with 5 distinct Card sections. Each card (account info, email change, password change, notifications, danger zone) maps to a natural sub-component. |
| DECOMP-04 | Top 5 mega-components in src/components/ decomposed below 300 lines | ranking-weight-controls (517), rank-timeline (501), search-dialog (485), models-filter-bar (470), leaderboard-explorer (457). Each has identifiable sub-sections for extraction. |
| PERF-02 | React.memo applied to expensive pure components identified during decomposition | Candidates: ComparisonRow, WeightRow (already exists as sub-component), ScoreBar, table row renderers, tab content wrappers. Only wrap components that receive primitive/memoized props and skip re-renders meaningfully. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component framework | Project standard |
| Next.js | 16.1.6 | App Router framework | Project standard |
| React.memo | Built-in React | Skip re-renders for pure components | No React Compiler enabled; manual memo needed |
| useCallback | Built-in React | Stable function references for memo'd children | Required to avoid breaking memo on callback props |
| useMemo | Built-in React | Stable object/array references | Required when passing computed data to memo'd children |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | 8.21.3 | Table in leaderboard-explorer | Already used; column defs stay in parent |
| recharts | 3.7.0 | Charts in rank-timeline | Already used; chart config stays in parent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React.memo | React Compiler | Compiler not enabled; would require build config change + potential regressions; out of scope for this phase |
| Manual decomposition | Barrel re-exports | Barrel files add indirection; direct imports are cleaner for this project size |

## Architecture Patterns

### Recommended Project Structure

For each decomposed component, create a sub-component directory or co-locate sub-components:

```
src/app/(catalog)/models/[slug]/
  page.tsx                    # ~250 lines: metadata + data fetching + layout shell
  _components/                # Underscore prefix = Next.js private folder (not a route)
    model-header.tsx          # Header section with badges, provider, actions
    model-stats-row.tsx       # Quick stats grid (7 stat cards)
    benchmarks-tab.tsx        # Benchmarks + ELO ratings tab content
    pricing-tab.tsx           # Pricing table + price comparison chart
    trading-tab.tsx           # Trading chart + market stats
    trends-tab.tsx            # Quality + downloads trend charts
    news-tab.tsx              # Grouped news items
    details-tab.tsx           # Technical specs + license cards
    changelog-tab.tsx         # Update timeline

src/app/compare/
  compare-client.tsx          # ~200 lines: state management + layout
  _components/
    model-selector.tsx        # Extracted from inline (already ~97 lines)
    comparison-row.tsx        # Table row with highlighting (already ~40 lines)
    overview-table.tsx        # Overview comparison section
    benchmarks-table.tsx      # Benchmark comparison section
    pricing-table.tsx         # Pricing + speed comparison
    visual-comparison.tsx     # Radar + price + scatter charts

src/app/(auth)/settings/
  settings-form.tsx           # ~120 lines: auth guard + layout
  _components/
    account-info-card.tsx     # Read-only account info display
    email-change-card.tsx     # Email change form
    password-change-card.tsx  # Password change form
    notification-prefs-card.tsx # Email + in-app notification toggles
    danger-zone-card.tsx      # Sign out + delete account

src/components/charts/
  rank-timeline.tsx           # ~180 lines: state + chart rendering
  rank-timeline-controls.tsx  # Header, metric toggle, days selector, model input
  rank-timeline-tags.tsx      # Tracked model tags with remove buttons

src/components/models/
  ranking-weight-controls.tsx # Already has WeightRow sub-component; extract helpers
  leaderboard-explorer.tsx    # ~200 lines: table setup
  leaderboard-controls.tsx    # Lens toggle + category tabs + search
  leaderboard-table.tsx       # Table rendering + pagination

src/components/
  search-dialog.tsx           # ~200 lines: dialog shell + state
  search-dialog-results.tsx   # Model + marketplace results
  search-dialog-default.tsx   # Recent searches + category quick links
```

### Pattern 1: Server Component Tab Extraction (for model detail page)

**What:** Extract each tab's content into a separate component file. Pass pre-fetched data as props.
**When to use:** Server components with large JSX sections that receive data from a single query point.
**Example:**
```typescript
// Source: Established project pattern from Phase 5 decomposition
// src/app/(catalog)/models/[slug]/_components/benchmarks-tab.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenchmarkRadar } from "@/components/charts/benchmark-radar";

interface BenchmarksTabProps {
  benchmarkScores: Array<{
    score: number | null;
    score_normalized: number | null;
    benchmarks: { name: string; category: string | null } | null;
  }>;
  eloRatings: Array<{
    arena_name: string;
    elo_score: number;
    rank: number | null;
    confidence_interval_low: number | null;
    confidence_interval_high: number | null;
    num_battles: number | null;
    snapshot_date: string | null;
  }>;
}

export function BenchmarksTab({ benchmarkScores, eloRatings }: BenchmarksTabProps) {
  // ... tab content JSX
}
```

### Pattern 2: Client Component Form Section Extraction (for settings form)

**What:** Extract each form card into a self-contained component that owns its own local state.
**When to use:** Client components where sections have independent state (loading, message, error per form).
**Example:**
```typescript
// src/app/(auth)/settings/_components/password-change-card.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PasswordChangeCardProps {
  userEmail: string;
}

export function PasswordChangeCard({ userEmail }: PasswordChangeCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // ... all password-related state and handlers live here
}
```

### Pattern 3: React.memo on Leaf Components

**What:** Wrap extracted sub-components with React.memo when they receive stable props and are expensive to render.
**When to use:** Components that render frequently due to parent state changes but whose own props rarely change.
**Example:**
```typescript
// src/app/compare/_components/comparison-row.tsx
import { memo } from "react";
import { Trophy } from "lucide-react";

interface ComparisonRowProps {
  label: string;
  values: (string | number | null)[];
  highlight?: "max" | "min" | null;
}

export const ComparisonRow = memo(function ComparisonRow({
  label,
  values,
  highlight,
}: ComparisonRowProps) {
  // ... row rendering logic
});
```

### Anti-Patterns to Avoid

- **Wrapping every component in React.memo:** Adds comparison cost. Only memo components where profiling or analysis shows unnecessary re-renders (parent state changes propagating to stable-prop children).
- **Memoizing components that receive new objects/arrays on every render:** The memo check itself becomes wasted work. Use useMemo on the parent side first, or pass primitive props.
- **Creating "barrel" index.ts files for sub-component directories:** This project uses direct imports. Don't add barrel files.
- **Moving data fetching into sub-components:** Server component data fetching stays in the page-level component. Sub-components receive data as props.
- **Extracting too granularly:** A 50-line sub-component that's only used once and has no memo benefit shouldn't be extracted. Aim for meaningful ~100-250 line sub-components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep prop comparison | Custom `arePropsEqual` | Restructure to primitive props | Deep comparison is slow and error-prone |
| Component render tracking | Manual console.log | React DevTools Profiler | Built-in tool shows actual render counts and timing |
| Stable callback refs | Manual ref caching | `useCallback` | React's built-in hook handles this correctly |
| Stable object refs | Manual memoization | `useMemo` | React's built-in hook with proper deps |

**Key insight:** The decomposition itself is more valuable than the memoization. Breaking 878-line components into focused 100-250 line pieces improves maintainability, testability, and enables targeted memoization. Don't over-engineer the memo strategy.

## Common Pitfalls

### Pitfall 1: Breaking Server Component Boundary
**What goes wrong:** Adding "use client" to extracted sub-components of the model detail page (which is a server component).
**Why it happens:** Habit from client component decomposition.
**How to avoid:** The model detail page (`page.tsx`) is a server component. All its extracted tab sub-components MUST also be server components (no "use client" directive). They receive pre-fetched data as props. Only components that already import client-side libraries (like CommentsSection, TradingChart, ModelOverview) remain client components.
**Warning signs:** Importing useState, useEffect, or browser APIs in tab components.

### Pitfall 2: React.memo on Components Receiving New Objects Every Render
**What goes wrong:** Wrapping a component in memo but its parent creates new object/array props on each render, defeating memoization.
**Why it happens:** Parent does `<Child data={{ ...model }}` or `<Child items={models.filter(...)}` inline.
**How to avoid:** Before wrapping a child in memo, ensure the parent's props are stable. Use useMemo for computed data, useCallback for functions. Or restructure to pass primitive props.
**Warning signs:** Parent uses inline object literals, array methods, or arrow functions as props to memo'd children.

### Pitfall 3: Forgetting to Move Inline Type Definitions
**What goes wrong:** Extracted sub-components need type definitions that were inline in the original file (like `pricingData` casts or `eloRatings` inline types).
**Why it happens:** The original file uses `as` casts or inline type annotations that need to become proper interfaces in the extracted component.
**How to avoid:** Define proper TypeScript interfaces for each sub-component's props. Move inline type casts to the data preparation section of the parent.
**Warning signs:** `as` casts appearing in sub-component files; duplicate type definitions.

### Pitfall 4: Breaking Existing Component Tests
**What goes wrong:** The 5 component tests from Phase 12 (search-dialog, marketplace-filter-bar, market-ticker, ranking-weight-controls, comments-section) break because imports change or internal structure shifts.
**Why it happens:** Tests import from the original file path; decomposition moves or renames things.
**How to avoid:** Keep exports from the same file path. If `search-dialog.tsx` is decomposed, the main `SearchDialog` export should still come from `search-dialog.tsx`. Sub-components are internal implementation details.
**Warning signs:** Import errors in test files after decomposition.

### Pitfall 5: Next.js Private Folder Convention
**What goes wrong:** Creating sub-component folders under `src/app/` route segments that Next.js tries to treat as routes.
**Why it happens:** Next.js App Router treats folders as route segments by default.
**How to avoid:** Use underscore prefix for component directories under route segments: `_components/` not `components/`. This tells Next.js to skip the folder for routing.
**Warning signs:** Build errors about missing `page.tsx` or unexpected route resolution.

### Pitfall 6: Memo on Context Consumers
**What goes wrong:** Wrapping a component in React.memo but it uses `useAuth()` or other context hooks internally, causing re-renders when context changes regardless of memo.
**Why it happens:** Developers assume memo prevents all re-renders; it only prevents prop-change-driven re-renders.
**How to avoid:** Don't memo components that heavily depend on frequently-changing context. Memo is most effective on pure leaf components that take primitive props.
**Warning signs:** A memo'd component still re-renders frequently in DevTools profiler due to context changes.

## Code Examples

### Decomposing a Server Component Tab

```typescript
// BEFORE: 878-line page.tsx with inline tab content
// AFTER: page.tsx ~250 lines, each tab ~80-150 lines

// src/app/(catalog)/models/[slug]/_components/pricing-tab.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceComparison } from "@/components/charts/price-comparison";
import { formatTokenPrice } from "@/lib/format";

interface PricingProvider {
  provider_name: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token: number | null;
}

interface PricingTabProps {
  pricingData: PricingProvider[];
}

export function PricingTab({ pricingData }: PricingTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Pricing Across Providers</CardTitle>
      </CardHeader>
      <CardContent>
        {/* ... pricing table JSX from lines 516-578 of original */}
      </CardContent>
    </Card>
  );
}
```

### Decomposing a Client Component with State Isolation

```typescript
// Settings form: each card section owns its own state
// src/app/(auth)/settings/_components/email-change-card.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface EmailChangeCardProps {
  currentEmail: string;
}

export function EmailChangeCard({ currentEmail }: EmailChangeCardProps) {
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const supabase = createClient();

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... handler logic
  };

  return (
    <Card className="border-border/50 bg-card">
      {/* ... card JSX */}
    </Card>
  );
}
```

### Applying React.memo Correctly

```typescript
// Source: https://react.dev/reference/react/memo
// ComparisonRow in compare page: parent re-renders when models array changes,
// but individual rows with unchanged values should skip rendering.
import { memo } from "react";

interface ComparisonRowProps {
  label: string;
  values: (string | number | null)[];
  highlight?: "max" | "min" | null;
}

export const ComparisonRow = memo(function ComparisonRow({
  label,
  values,
  highlight,
}: ComparisonRowProps) {
  // ... rendering logic
});

// Usage in parent: values array must be stable (useMemo) for memo to work
const overviewValues = useMemo(
  () => models.map((m) => m.quality_score ? Number(m.quality_score).toFixed(1) : null),
  [models]
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React.memo everywhere | Selective React.memo on measured bottlenecks | React 19 (2024) | Reduced complexity; compiler handles most cases when enabled |
| shouldComponentUpdate | React.memo | React 16.6 (2018) | Functional component equivalent |
| Class component splitting | Function component + hooks extraction | React 16.8 (2019) | Custom hooks enable state logic reuse |

**Project-specific note:** React Compiler is NOT enabled in this project (no `reactCompiler: true` in next.config.ts, no `babel-plugin-react-compiler` in package.json). Therefore, manual React.memo is genuinely beneficial for expensive pure components. If the compiler were enabled, memo would become redundant for most cases.

## Candidate Analysis: React.memo Targets

Based on codebase analysis, these are the best candidates for React.memo:

### High-Value Candidates (likely to skip re-renders)
| Component | Location | Why | Props Profile |
|-----------|----------|-----|--------------|
| ComparisonRow | compare/_components/ | Rendered N times per model; parent re-renders on model add/remove | Primitives: label, values array, highlight string |
| WeightRow | ranking-weight-controls.tsx | Already a sub-component; 5 instances, parent re-renders on any weight change | Primitives + signal object (stable reference) |
| ScoreBar | leaderboard-explorer.tsx | Rendered per cell per row (50+ per page); parent sorts/filters | Single number prop |
| Tab content components | model detail _components/ | Server component children; no re-render concern | N/A -- server components don't re-render |

### Low-Value Candidates (skip memo)
| Component | Why Skip |
|-----------|----------|
| ModelSelector | Only 1 instance; toggles open/close; own state dominates |
| SearchDialog sub-components | Low instance count; state-heavy; context consumers |
| Settings form cards | Each card owns its own state; parent rarely re-renders independently |
| Filter bar sections | 1 instance; URL-driven state; entire component re-renders on any filter change |

### Verdict
Focus React.memo on: **ComparisonRow**, **WeightRow**, **ScoreBar**, and any new leaf sub-components from leaderboard-explorer decomposition that render per-row in the 50-row table. Settings form and search dialog decompositions benefit from decomposition itself (maintainability) but not from memo.

## Decomposition Size Estimates

| File | Current Lines | Target | Estimated Sub-components | Lines After |
|------|--------------|--------|-------------------------|-------------|
| `models/[slug]/page.tsx` | 878 | <300 | 9 tab/section components | ~250 (parent) |
| `compare/compare-client.tsx` | 718 | <300 | 4-5 section components | ~200 (parent) |
| `settings/settings-form.tsx` | 681 | <300 | 5 card components | ~120 (parent) |
| `ranking-weight-controls.tsx` | 517 | <300 | Extract helper functions to separate file | ~280 (WeightRow already extracted) |
| `rank-timeline.tsx` | 501 | <300 | 2-3 sub-components (controls, tags) | ~200 (parent) |
| `search-dialog.tsx` | 485 | <300 | 2-3 sub-components (results, default state) | ~200 (parent) |
| `models-filter-bar.tsx` | 470 | <300 | 1-2 sub-components (filter sheet content) | ~250 (parent) |
| `leaderboard-explorer.tsx` | 457 | <300 | 2-3 sub-components (controls, table) | ~200 (parent) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 with jsdom + node projects |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECOMP-01 | Model detail page decomposed, all tabs render | smoke (build) | `npx tsc --noEmit` | N/A -- verified by build |
| DECOMP-02 | Compare client decomposed, comparison works | unit | `npx vitest run` (existing tests) | No dedicated test -- manual |
| DECOMP-03 | Settings form decomposed, forms work | unit | `npx vitest run` (existing tests) | No dedicated test -- manual |
| DECOMP-04 | Top 5 components decomposed under 300 lines | unit + component | `npx vitest run` | Partial: search-dialog.test.tsx, ranking-weight-controls.test.tsx |
| PERF-02 | React.memo skips re-renders | manual | React DevTools Profiler | Manual-only: requires browser DevTools |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npx vitest run`
- **Per wave merge:** `npx tsc --noEmit && npx vitest run`
- **Phase gate:** Full suite green + line count verification

### Wave 0 Gaps
- [ ] Line count verification script -- `wc -l` on all 8 target files, assert < 300
- [ ] No new test infrastructure needed -- existing Vitest + jsdom setup from Phase 12 covers component tests

## Open Questions

1. **Line count for ranking-weight-controls.tsx**
   - What we know: Currently 517 lines. Already has WeightRow as internal sub-component (~90 lines). The helper functions (computePercentiles, redistributeWeights, getRawValue) are ~130 lines.
   - What's unclear: Extracting helpers to a separate utils file gets it to ~290 lines. Tight margin.
   - Recommendation: Extract helper functions + types to `ranking-weight-helpers.ts`. This is a clean split: types + pure functions in one file, React component + sub-component in another.

2. **models-filter-bar.tsx at 470 lines**
   - What we know: The Sheet content (filter panel) is ~200 lines of JSX. The outer bar is ~270 lines.
   - What's unclear: Whether extracting the sheet content alone gets it under 300.
   - Recommendation: Extract `FilterSheetContent` as a sub-component. This gets the parent to ~270 lines comfortably.

## Sources

### Primary (HIGH confidence)
- [React.memo official docs](https://react.dev/reference/react/memo) - Full API reference, caveats, usage patterns
- Project codebase analysis - Direct file reading of all 8 target components
- Phase 5 verification report - Established decomposition patterns and precedent

### Secondary (MEDIUM confidence)
- [React 19 memo best practices](https://dev.to/shantih_palani/is-reactmemo-still-useful-in-react-19-a-practical-guide-for-2025-4lj5) - React.memo relevance in React 19
- [React Compiler auto-memoization](https://www.infoq.com/news/2025/12/react-compiler-meta/) - Confirms compiler is separate opt-in; not enabled by default
- [React performance optimization 2025](https://dev.to/alex_bobes/react-performance-optimization-15-best-practices-for-2025-17l9) - Community patterns

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React.memo is stable React API; project uses React 19.2.3 confirmed
- Architecture: HIGH - Phase 5 decomposition pattern is proven in this exact codebase
- Pitfalls: HIGH - Based on direct code analysis of target files and their dependencies
- React.memo candidates: MEDIUM - Analysis is sound but actual performance impact requires profiling

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable patterns, unlikely to change)
