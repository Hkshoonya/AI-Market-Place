# Phase 14: SWR Data Fetching - Research

**Researched:** 2026-03-09
**Domain:** Client-side data fetching, caching, revalidation (React/Next.js)
**Confidence:** HIGH

## Summary

This phase replaces all client-side `useState + useEffect + fetch` data fetching patterns with SWR (`useSWR`) hooks, providing automatic caching, deduplication, background revalidation, and stale-while-revalidate behavior. The project has **two distinct data fetching patterns** in client components: (1) `fetch()` calls to API routes (~25 components), and (2) direct Supabase client queries via `createClient()` in `useEffect` (~12 components). Both patterns must be converted.

SWR 2.4.x is the current stable release, maintained by Vercel (the same team behind Next.js), weighs ~4.2KB gzipped, has zero peer dependencies beyond React, and works well with Next.js 16 App Router. The project already uses the App Router pattern with `"use client"` directives, so SWR integrates naturally. A global `SWRConfig` provider should be added to the existing provider chain in `layout.tsx`, and a shared fetcher utility created. StaleTime tiers map to SWR's `dedupingInterval` and `refreshInterval` options.

**Primary recommendation:** Install SWR 2.x, create a global `SWRConfig` with a shared JSON fetcher, define 3 revalidation tiers (fast/medium/slow), and systematically convert all useState+useEffect+fetch patterns to `useSWR` hooks. For Supabase-direct queries, wrap them in fetcher functions that SWR can call.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | SWR replaces useState+useEffect+fetch patterns in client components with appropriate staleTime tiers | Full research coverage: SWR API, configuration options, tiered revalidation strategy, complete file inventory of ~37 components needing conversion |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| swr | ^2.4.1 | Client-side data fetching with caching and revalidation | Created by Vercel (same team as Next.js), officially recommended for Next.js client-side fetching, minimal bundle (~4.2KB gzip), TypeScript native |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | SWR has no additional dependencies | - |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWR | TanStack Query (React Query) | Heavier (~13KB gzip), more features (infinite queries, optimistic updates built-in), but requirement explicitly says "SWR" |
| SWR | Native React `use()` + Suspense | Experimental, not production-ready for all patterns, no built-in cache management |

**Installation:**
```bash
npm install swr
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    swr/
      fetcher.ts           # Shared fetcher function(s)
      config.ts            # Revalidation tier constants
  hooks/
    use-wallet-balance.ts  # Convert existing hook to SWR
    use-earnings-data.ts   # Convert existing hook to SWR
  app/
    layout.tsx             # Add SWRConfig provider
    providers.tsx          # Or add SWRConfig here
```

### Pattern 1: Global SWRConfig Provider
**What:** A single `SWRConfig` at the root of the app providing default fetcher and revalidation settings.
**When to use:** Always -- every SWR-enabled app needs this.
**Example:**
```typescript
// Source: https://swr.vercel.app/docs/global-configuration
import { SWRConfig } from 'swr';

const jsonFetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
});

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{
      fetcher: jsonFetcher,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      errorRetryCount: 3,
    }}>
      {children}
    </SWRConfig>
  );
}
```

### Pattern 2: Revalidation Tiers via Per-Hook Options
**What:** Different refresh intervals and deduplication windows for data that changes at different rates.
**When to use:** Core requirement -- scores change frequently, model metadata changes rarely.
**Example:**
```typescript
// Source: https://swr.vercel.app/docs/api
// FAST tier: market ticker, top movers, auction data (30s refresh)
const { data } = useSWR('/api/charts/ticker', {
  refreshInterval: 30_000,
  dedupingInterval: 10_000,
});

// MEDIUM tier: notifications, wallet balance, order status (60s refresh)
const { data } = useSWR('/api/notifications', {
  refreshInterval: 60_000,
  dedupingInterval: 30_000,
});

// SLOW tier: model metadata, descriptions, deployments (5min+ or no auto-refresh)
const { data } = useSWR(`/api/models/${slug}/description`, {
  refreshInterval: 0,  // no polling, revalidate on focus only
  dedupingInterval: 300_000,
});
```

### Pattern 3: Replacing useState+useEffect+fetch (API Route Pattern)
**What:** Direct 1:1 replacement of the most common pattern in the codebase.
**When to use:** For all components that call `fetch('/api/...')` inside `useEffect`.
**Example:**
```typescript
// BEFORE (current pattern in ~25 components):
const [data, setData] = useState<TopMoversData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetch("/api/charts/top-movers?limit=10")
    .then((r) => r.json())
    .then((d) => setData(d))
    .catch(() => setError("Failed to load"))
    .finally(() => setLoading(false));
}, []);

// AFTER:
const { data, error, isLoading } = useSWR<TopMoversData>(
  '/api/charts/top-movers?limit=10'
);
```

### Pattern 4: Replacing Supabase Client Direct Queries
**What:** Wrapping Supabase queries in a fetcher function so SWR can manage caching.
**When to use:** For components that use `createClient()` + `supabase.from()` in useEffect (~12 components).
**Example:**
```typescript
// BEFORE (current pattern in admin pages, orders, profile, comments):
const [data, setData] = useState(null);
useEffect(() => {
  const supabase = createClient();
  supabase.from("models").select("*").then(({ data }) => setData(data));
}, []);

// AFTER (wrap in fetcher):
const { data, error, isLoading } = useSWR(
  'supabase:admin-stats',  // unique cache key
  async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("models").select("*");
    if (error) throw error;
    return data;
  }
);
```

### Pattern 5: Conditional Fetching (Auth-Gated Data)
**What:** Only fetch when user is authenticated.
**When to use:** For components that check `user` before fetching (orders, watchlists, wallet, etc.).
**Example:**
```typescript
// Source: https://swr.vercel.app/docs/conditional-fetching
const { user } = useAuth();

// Pass null key to disable fetching when user is absent
const { data: orders } = useSWR(
  user ? `/api/marketplace/orders?buyer=${user.id}` : null
);
```

### Pattern 6: Dynamic Keys with Parameters
**What:** SWR key changes when parameters change, automatically refetching.
**When to use:** For components like rank-timeline, trading-chart that depend on user-selected filters.
**Example:**
```typescript
// BEFORE:
const [slugs, setSlugs] = useState(DEFAULT_SLUGS);
const [days, setDays] = useState(30);
const fetchData = useCallback(async () => {
  const params = new URLSearchParams({ slugs: slugs.join(","), days: String(days) });
  const res = await fetch(`/api/charts/rank-timeline?${params}`);
  // ...
}, [slugs, days]);
useEffect(() => { fetchData(); }, [fetchData]);

// AFTER:
const params = new URLSearchParams({ slugs: slugs.join(","), days: String(days) });
const { data, error, isLoading } = useSWR<ApiResponse>(
  `/api/charts/rank-timeline?${params}`
);
```

### Pattern 7: Mutation with Revalidation
**What:** After a POST/PUT/DELETE, revalidate the related SWR cache.
**When to use:** For components that modify data and then re-fetch (comments, watchlists, orders).
**Example:**
```typescript
import useSWR, { useSWRConfig } from 'swr';

const { data: comments, mutate } = useSWR(`/api/comments?model=${modelId}`);

const submitComment = async (content: string) => {
  await fetch('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ content, modelId }),
  });
  // Revalidate the comments list
  mutate();
};
```

### Anti-Patterns to Avoid
- **Putting fetch logic inside SWR fetcher:** The global fetcher handles JSON parsing. Don't create per-component fetchers that duplicate error handling -- use the global one.
- **Using refreshInterval for everything:** Only fast-changing data (ticker, auction prices) needs polling. Most data should rely on focus/reconnect revalidation.
- **Forgetting to handle the `error` state:** SWR returns `error` separately from `data`. Components must render error UI.
- **Creating SWR keys with unstable references:** Object/array keys cause infinite refetch loops if not serialized to strings. Use string keys (URL paths or stable serialized strings).
- **Mixing SWR and raw useEffect+fetch in the same component:** After conversion, a component should not have both patterns. If mutation needs fetch, use `mutate()` from the SWR hook.

## Complete File Inventory

### Category A: API Route fetch() in useEffect (~25 components)
These are the simplest conversions -- replace useState+useEffect+fetch with useSWR.

| File | API Route | Tier | Notes |
|------|-----------|------|-------|
| `src/components/layout/market-ticker.tsx` | `/api/charts/ticker` | FAST | Polling every 30s |
| `src/components/charts/top-movers.tsx` | `/api/charts/top-movers` | FAST | Scores change with syncs |
| `src/components/charts/trading-chart.tsx` | `/api/charts/trading` | MEDIUM | Dynamic params (metric, range, model) |
| `src/components/charts/rank-timeline.tsx` | `/api/charts/rank-timeline` | MEDIUM | Dynamic params (slugs, days, metric) |
| `src/components/charts/quality-price-frontier.tsx` | `/api/charts/quality-price` | MEDIUM | Filter-dependent |
| `src/components/charts/benchmark-heatmap.tsx` | `/api/charts/benchmark-heatmap` | MEDIUM | Filter-dependent |
| `src/components/models/model-overview.tsx` | `/api/models/[slug]/description` | SLOW | Rarely changes |
| `src/components/models/deploy-tab.tsx` | `/api/models/[slug]/deployments` | SLOW | Rarely changes |
| `src/components/models/trending-models.tsx` | `/api/trending` | MEDIUM | Category/limit params |
| `src/components/search-dialog.tsx` | `/api/search` | N/A | Debounced user input; special handling needed |
| `src/components/notifications/notification-bell.tsx` | `/api/notifications`, `/api/activity` | MEDIUM | Auth-gated, polling |
| `src/components/notifications/activity-feed.tsx` | `/api/activity` | MEDIUM | Auth-gated |
| `src/components/marketplace/wallet-badge.tsx` | `/api/marketplace/wallet` | MEDIUM | Auth-gated |
| `src/components/marketplace/listing-reviews.tsx` | `/api/marketplace/listings/[slug]/reviews` | SLOW | Mutation + refetch |
| `src/components/marketplace/english-bid-panel.tsx` | `/api/marketplace/auctions/[id]/bid` | FAST | Auction-related |
| `src/components/watchlists/add-to-watchlist.tsx` | `/api/watchlists` | MEDIUM | Auth-gated |
| `src/hooks/use-wallet-balance.ts` | `/api/marketplace/wallet` | MEDIUM | Custom hook, conditional |
| `src/hooks/use-earnings-data.ts` | `/api/seller/earnings`, `/api/seller/withdraw` | MEDIUM | Two fetches, mutation |
| `src/app/(auth)/watchlists/watchlists-content.tsx` | `/api/watchlists` | MEDIUM | Auth-gated, mutation |
| `src/app/(auth)/watchlists/[id]/watchlist-detail-content.tsx` | `/api/watchlists/[id]` | MEDIUM | Auth-gated, mutation |
| `src/app/(auth)/settings/api-keys/api-keys-content.tsx` | `/api/api-keys` | SLOW | Auth-gated, mutation |
| `src/app/(marketplace)/dashboard/seller/seller-dashboard-content.tsx` | `/api/marketplace/seller/verify`, `/api/marketplace/seller/stats` | MEDIUM | Auth-gated |
| `src/app/(marketplace)/marketplace/auctions/[id]/auction-detail-content.tsx` | `/api/marketplace/auctions/[id]` | FAST | Auction data |
| `src/app/(marketplace)/marketplace/auctions/auctions-browse-content.tsx` | `/api/marketplace/auctions` | MEDIUM | Filter params |
| `src/app/(admin)/admin/verifications/page.tsx` | `/api/admin/verifications` | MEDIUM | Admin, mutation |
| `src/app/(admin)/admin/listings/page.tsx` | `/api/admin/listings` | MEDIUM | Admin, pagination |
| `src/app/(admin)/admin/agents/agents-content.tsx` | `/api/admin/agents`, `/api/admin/agents/tasks`, `/api/admin/agents/logs` | MEDIUM | Admin, multi-fetch |
| `src/app/(admin)/admin/data-sources/page.tsx` | `/api/admin/data-sources` | SLOW | Admin |
| `src/app/(auth)/orders/[id]/order-detail-content.tsx` | `/api/marketplace/orders/[id]/messages` | MEDIUM | Auth-gated, polling |

### Category B: Supabase Client Direct Queries (~12 components)
These need fetcher wrappers or conversion to API route + SWR.

| File | Query Target | Tier | Notes |
|------|-------------|------|-------|
| `src/app/(admin)/admin/page.tsx` | Multiple Supabase tables | SLOW | Admin dashboard stats |
| `src/app/(admin)/admin/analytics/page.tsx` | models table aggregations | SLOW | Admin analytics |
| `src/app/(admin)/admin/models/page.tsx` | models table with filters | MEDIUM | Admin, pagination |
| `src/app/(admin)/admin/reviews/page.tsx` | reviews + listings tables | MEDIUM | Admin |
| `src/app/(admin)/admin/users/page.tsx` | profiles table | MEDIUM | Admin |
| `src/app/(auth)/orders/orders-content.tsx` | marketplace_orders + profiles | MEDIUM | Auth-gated, two-query enrichment |
| `src/app/(auth)/profile/profile-content.tsx` | user_bookmarks + watchlists | SLOW | Auth-gated |
| `src/components/models/comments-section.tsx` | comments + profiles tables | MEDIUM | Two-query enrichment, mutations |
| `src/components/marketplace/seller-orders-table.tsx` | marketplace_orders + profiles | MEDIUM | Auth-gated, mutations |
| `src/components/marketplace/seller-listings-table.tsx` | marketplace_listings | MEDIUM | Auth-gated, mutations |
| `src/app/(marketplace)/dashboard/seller/listings/[slug]/edit/edit-listing-content.tsx` | marketplace_listings | SLOW | Auth-gated |
| `src/app/(auth)/wallet/wallet-content.tsx` | wallet via API route | MEDIUM | Auth-gated |

### Category C: Not SWR Candidates (exclude from conversion)
| File | Reason |
|------|--------|
| `src/hooks/use-auction-timer.ts` | Timer logic (setInterval), not data fetching |
| `src/hooks/use-debounce.ts` | Utility hook, not data fetching |
| `src/hooks/use-heatmap-tooltip.ts` | UI interaction hook, not data fetching |
| `src/components/pwa-register.tsx` | Service worker registration, not data fetching |
| `src/components/auth/auth-provider.tsx` | Auth state management (Supabase onAuthStateChange), not data fetching |
| `src/app/providers.tsx` | PostHog initialization, not data fetching |
| `src/components/models/model-view-tracker.tsx` | Fire-and-forget POST, not data fetching |
| `src/components/marketplace/view-tracker.tsx` | Fire-and-forget POST, not data fetching |
| `src/components/scroll-to-top.tsx` | Scroll behavior, not data fetching |
| `src/app/**/error.tsx` (12 files) | Error boundary components with useEffect for Sentry reporting |
| `src/app/(auth)/activity/activity-content.tsx` | Only redirects via useEffect, delegates to ActivityFeed |
| `src/app/(auth)/settings/settings-form.tsx` | Only syncs profile state to form fields via useEffect |
| `src/components/models/models-filter-bar.tsx` | URL search params sync via useEffect |
| `src/app/compare/compare-client.tsx` | URL params sync + Supabase (complex, see notes below) |

**Note on compare-client.tsx:** This component fetches from Supabase using URL-driven model slugs, but its data loading is deeply intertwined with URL state management and the comparison UI. Converting this to SWR is feasible but requires careful key design. It should be included as a Category B item.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request deduplication | Custom dedup logic | SWR's built-in `dedupingInterval` | SWR deduplicates identical concurrent requests automatically |
| Cache invalidation | Custom cache with timestamps | SWR's `mutate()` + auto-revalidation | Manual cache invalidation is error-prone; SWR handles it |
| Background revalidation | setInterval + fetch | SWR's `refreshInterval` + `revalidateOnFocus` | SWR pauses polling when tab is hidden, resumes on focus |
| Loading/error state | `useState(true)` + `useState(null)` | SWR's `isLoading`, `error` returns | 3 useState calls replaced by destructured hook returns |
| Retry on error | Custom retry logic | SWR's `errorRetryCount` + `errorRetryInterval` | Exponential backoff built-in |
| Optimistic updates | Manual state rollback | SWR's `optimisticData` + `rollbackOnError` | SWR handles cache rollback automatically on mutation failure |

**Key insight:** The current codebase has ~37 components each implementing their own loading/error/data state management. SWR eliminates this boilerplate entirely, reducing each data-fetching component by 5-15 lines.

## Common Pitfalls

### Pitfall 1: Unstable SWR Keys Causing Infinite Refetches
**What goes wrong:** Passing objects or arrays as SWR keys (e.g., `useSWR({ url, params })`) without stable references causes continuous refetching because SWR uses referential equality for key comparison.
**Why it happens:** React creates new object references on each render.
**How to avoid:** Always use string keys. Serialize parameters into URL query strings: `useSWR(\`/api/data?${params.toString()}\`)`.
**Warning signs:** Network tab shows repeated identical requests, component re-renders continuously.

### Pitfall 2: Forgetting Conditional Fetching for Auth-Gated Data
**What goes wrong:** SWR fires a request to an auth-protected endpoint before the user is authenticated, returning 401 errors.
**Why it happens:** SWR fetches immediately on mount by default.
**How to avoid:** Pass `null` as the key when the user is not authenticated: `useSWR(user ? '/api/data' : null)`.
**Warning signs:** Console shows 401 errors on page load, Sentry captures unnecessary auth errors.

### Pitfall 3: Over-Polling with refreshInterval
**What goes wrong:** Setting `refreshInterval` on slow-changing data wastes bandwidth and server resources.
**Why it happens:** Developers apply fast-refresh settings globally instead of per-tier.
**How to avoid:** Only use `refreshInterval` for genuinely fast-changing data (ticker, auctions). Most data should use `revalidateOnFocus: true` (the default) without polling.
**Warning signs:** API route logs show excessive GET requests for static-ish data.

### Pitfall 4: Not Handling SWR's `undefined` Initial State
**What goes wrong:** Components crash because `data` is `undefined` before the first fetch completes.
**Why it happens:** SWR returns `undefined` for `data` while loading, unlike the previous pattern where `useState(null)` is explicit.
**How to avoid:** Always handle `isLoading` state or provide `fallbackData`. Use optional chaining on `data`.
**Warning signs:** "Cannot read property X of undefined" errors.

### Pitfall 5: Supabase Client Module-Level Instantiation
**What goes wrong:** Some components create `const supabase = createClient()` at module level (outside the component). When converting to SWR, the fetcher must still use this pattern correctly.
**Why it happens:** Supabase client is lightweight and designed for module-level creation.
**How to avoid:** Keep `createClient()` at module level or inside the fetcher. Both work -- just be consistent.
**Warning signs:** Stale auth tokens in Supabase queries (rare with @supabase/ssr).

### Pitfall 6: Debounced Search Conflicts with SWR
**What goes wrong:** The search dialog uses manual debouncing (setTimeout) which conflicts with SWR's deduplication.
**Why it happens:** SWR deduplicates by key, but if the key changes rapidly (each keystroke), dedup doesn't help.
**How to avoid:** Keep the debounce logic for the search dialog. Use the debounced query string as the SWR key. The `keepPreviousData: true` option helps show results while typing.
**Warning signs:** Search feels laggy or shows stale results.

### Pitfall 7: Breaking Existing Component Tests
**What goes wrong:** Existing component tests mock `fetch` directly. After SWR conversion, tests may fail because SWR adds caching behavior.
**Why it happens:** SWR caches responses between renders, so tests may see stale cached data from previous test cases.
**How to avoid:** Wrap test components in `<SWRConfig value={{ provider: () => new Map() }}>` to create a fresh cache per test. This is the official SWR testing pattern.
**Warning signs:** Tests pass individually but fail when run together.

## Code Examples

### Global SWR Setup
```typescript
// src/lib/swr/fetcher.ts
// Source: https://swr.vercel.app/docs/getting-started

export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Fetch failed');
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
  return res.json();
}
```

```typescript
// src/lib/swr/config.ts
// Revalidation tier constants

export const SWR_TIERS = {
  /** Fast-changing data: ticker, top movers, auction prices */
  FAST: {
    refreshInterval: 30_000,
    dedupingInterval: 10_000,
  },
  /** Medium-changing data: notifications, wallet, order status */
  MEDIUM: {
    refreshInterval: 60_000,
    dedupingInterval: 30_000,
  },
  /** Slow-changing data: model descriptions, deployments, metadata */
  SLOW: {
    refreshInterval: 0,  // no polling; revalidate on focus only
    dedupingInterval: 300_000,
  },
} as const;
```

```typescript
// In layout.tsx provider chain:
import { SWRConfig } from 'swr';
import { jsonFetcher } from '@/lib/swr/fetcher';

// Add SWRConfig wrapping around existing providers:
<SWRConfig value={{ fetcher: jsonFetcher }}>
  <PHProvider>
    <AuthProvider>
      ...
    </AuthProvider>
  </PHProvider>
</SWRConfig>
```

### Simple Component Conversion
```typescript
// Source: SWR docs + project pattern

// BEFORE (top-movers.tsx):
export default function TopMovers() {
  const [data, setData] = useState<TopMoversData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"risers" | "fallers">("risers");

  useEffect(() => {
    fetch("/api/charts/top-movers?limit=10")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError("Failed to load top movers"))
      .finally(() => setLoading(false));
  }, []);

  // ...render with data, loading, error...
}

// AFTER:
import useSWR from 'swr';
import { SWR_TIERS } from '@/lib/swr/config';

export default function TopMovers() {
  const { data, error, isLoading } = useSWR<TopMoversData>(
    '/api/charts/top-movers?limit=10',
    { ...SWR_TIERS.FAST }
  );
  const [tab, setTab] = useState<"risers" | "fallers">("risers");

  // ...render with data, isLoading, error...
}
```

### Custom Hook Conversion
```typescript
// BEFORE (use-wallet-balance.ts):
export function useWalletBalance({ enabled }: { enabled: boolean }) {
  const [walletData, setWalletData] = useState<WalletBalance | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const fetchBalance = useCallback(async () => { /* fetch logic */ }, []);
  useEffect(() => { if (enabled) fetchBalance(); }, [enabled, fetchBalance]);
  return { walletData, loadingWallet, refetch: fetchBalance };
}

// AFTER:
import useSWR from 'swr';
import { SWR_TIERS } from '@/lib/swr/config';

export function useWalletBalance({ enabled }: { enabled: boolean }) {
  const { data, isLoading, mutate } = useSWR<WalletBalance>(
    enabled ? '/api/marketplace/wallet' : null,
    { ...SWR_TIERS.MEDIUM }
  );
  return {
    walletData: data ?? null,
    loadingWallet: isLoading,
    refetch: () => mutate(),
  };
}
```

### Supabase Direct Query Conversion
```typescript
// BEFORE (admin/page.tsx):
useEffect(() => {
  const fetchStats = async () => {
    const supabase = createClient();
    const [{ count: totalModels }, ...] = await Promise.all([
      supabase.from("models").select("*", { count: "exact", head: true }),
      // ...more queries
    ]);
    setStats({ totalModels, ... });
  };
  fetchStats();
}, []);

// AFTER:
const { data: stats, isLoading } = useSWR<AdminStats>(
  'supabase:admin-overview',
  async () => {
    const supabase = createClient();
    const [{ count: totalModels }, ...] = await Promise.all([
      supabase.from("models").select("*", { count: "exact", head: true }),
      // ...
    ]);
    return { totalModels: totalModels ?? 0, ... };
  },
  { ...SWR_TIERS.SLOW }
);
```

### Testing SWR Components
```typescript
// Source: https://swr.vercel.app/docs/advanced/cache
import { SWRConfig } from 'swr';
import { render, screen } from '@testing-library/react';

// Wrap in SWRConfig with fresh cache to prevent test pollution
function renderWithSWR(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>
  );
}

it('shows ticker data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ name: 'GPT-4', slug: 'gpt-4', score: 95 }]),
  }));

  renderWithSWR(<MarketTicker />);
  expect(await screen.findByText('GPT-4')).toBeInTheDocument();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useState + useEffect + fetch | useSWR hook | SWR 1.0 (2021), stable since 2.0 (2023) | Eliminates boilerplate, adds caching/dedup for free |
| Manual cache invalidation | SWR `mutate()` + auto-revalidation | SWR 2.0 | No more manual cache management |
| Custom polling with setInterval | SWR `refreshInterval` | SWR 1.0 | Auto-pauses when tab hidden, resumes on focus |
| Manual error retry | SWR `errorRetryCount` + backoff | SWR 1.0 | Built-in exponential backoff |

**Deprecated/outdated:**
- SWR 1.x: Still works but lacks `isLoading` (added in 2.0), `keepPreviousData`, and improved TypeScript generics
- `revalidateOnMount` default changed in 2.0: Now auto-detects based on `fallbackData` presence

## Open Questions

1. **Search Dialog Debounce Strategy**
   - What we know: The search dialog uses manual setTimeout debouncing (250ms) before calling `fetch('/api/search')`. SWR can handle this but the debounce must remain.
   - What's unclear: Whether to keep the manual debounce or use a `useSWR` key that updates after debounce. Both work.
   - Recommendation: Keep manual debounce, use debounced query as SWR key. This preserves existing UX while adding caching for repeated searches.

2. **Supabase Direct Query Migration Scope**
   - What we know: ~12 components query Supabase directly. These can be wrapped in SWR fetcher functions with custom cache keys.
   - What's unclear: Whether some of these should be converted to API routes first (for consistency) or kept as Supabase-direct with SWR wrappers.
   - Recommendation: Wrap Supabase queries in inline SWR fetchers. Creating new API routes would be scope creep. The SWR cache key pattern `'supabase:entity-name'` works well.

3. **Provider Ordering in layout.tsx**
   - What we know: Current order is `PHProvider > AuthProvider > TooltipProvider`. SWRConfig needs to wrap all data-fetching components.
   - What's unclear: Whether SWRConfig should go inside or outside PHProvider.
   - Recommendation: Place SWRConfig outermost (before PHProvider) since it has no dependency on PostHog or Auth, and data fetching hooks may be used anywhere.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Testing Library (jsdom) |
| Config file | `vitest.config.ts` (two projects: unit + component) |
| Quick run command | `npx vitest run --project component` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01a | SWR replaces fetch patterns in a representative component | component | `npx vitest run src/components/layout/market-ticker.test.tsx -x` | Exists (needs update) |
| PERF-01b | SWR config provides global fetcher and tiers | unit | `npx vitest run src/lib/swr/config.test.ts -x` | Wave 0 |
| PERF-01c | Cached data shown immediately on re-mount | component | `npx vitest run src/components/charts/top-movers.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update existing component tests (market-ticker, search-dialog, comments-section, ranking-weight-controls, filter-bar) to wrap with `<SWRConfig value={{ provider: () => new Map() }}>` for test isolation
- [ ] `src/lib/swr/config.test.ts` -- verify tier constants are well-typed
- [ ] Update `vi.stubGlobal('fetch')` mocks in existing tests to work with SWR's fetch timing

## Sources

### Primary (HIGH confidence)
- [SWR Official Docs](https://swr.vercel.app/docs/getting-started) - API, configuration, TypeScript
- [SWR API Reference](https://swr.vercel.app/docs/api) - All configuration options with defaults
- [SWR Global Configuration](https://swr.vercel.app/docs/global-configuration) - SWRConfig provider pattern
- [SWR with Next.js](https://swr.vercel.app/docs/with-nextjs) - App Router integration, prefetching
- [SWR Mutation](https://swr.vercel.app/docs/mutation) - mutate(), useSWRMutation, optimistic updates
- [SWR TypeScript](https://swr.vercel.app/docs/typescript) - Generic typing, Fetcher type

### Secondary (MEDIUM confidence)
- [GitHub Discussion #4095](https://github.com/vercel/swr/discussions/4095) - SWR viability with Next.js App Router (community discussion, still relevant)
- [npm swr](https://www.npmjs.com/package/swr) - Version 2.4.1 confirmed as latest

### Tertiary (LOW confidence)
- Bundle size estimate (~4.2KB gzip) from training data, not verified with bundlephobia for 2.4.x

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SWR is officially recommended by Vercel/Next.js team, well-documented, stable API
- Architecture: HIGH - Patterns verified against official docs, file inventory verified by codebase grep
- Pitfalls: HIGH - Common pitfalls documented in official docs and community resources; test isolation pattern from SWR docs
- File inventory: HIGH - Every file verified by searching the actual codebase

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (SWR API is stable, unlikely to change significantly)
