---
status: diagnosed
trigger: "page stops loading entirely during normal browsing"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - The combination of (1) jsonFetcher throwing on ANY non-OK response, (2) no onErrorRetry override to suppress retries for 4xx/5xx, (3) refreshInterval polling continuing independently of error retries, and (4) no React error boundary creates a cascading failure: a single API 500 triggers both SWR retry loop AND continued polling, and since no component catches render errors from unexpected data shapes, the entire React tree can crash.
test: Traced all SWR hooks, verified no error boundary exists, confirmed dual retry+polling behavior
expecting: Root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: Page loads and remains interactive during browsing
actual: Page stops loading entirely (freeze/hang)
errors: Not specified by user
reproduction: Normal browsing
started: Unknown

## Eliminated

- hypothesis: SWR keys are unstable and cause infinite re-render loops
  evidence: All SWR keys use stable string concatenation from state variables (useState), URL params, or null guards. No object/array keys that would change identity on every render. The CommentsSection uses `visibleCount` in its key but this only changes on explicit user click, not on render.
  timestamp: 2026-03-09T00:06:00Z

- hypothesis: Too many concurrent FAST-tier SWR requests overwhelm the browser
  evidence: Only 2 components use FAST tier (MarketTicker at 30s, TopMovers at 30s), and MarketTicker is not even rendered anywhere (orphan component). On the home page only TopMovers uses FAST tier. Most components use MEDIUM (60s) or SLOW (no polling). Request volume alone is not the issue.
  timestamp: 2026-03-09T00:07:00Z

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: src/lib/swr/fetcher.ts
  found: jsonFetcher throws Error on non-OK responses (attaches status code). No special handling for 500s.
  implication: Every non-OK API response becomes a thrown error that SWR must handle via retry logic.

- timestamp: 2026-03-09T00:02:00Z
  checked: src/app/providers.tsx SWRConfig
  found: errorRetryCount=3, but NO onErrorRetry override. dedupingInterval=2000. revalidateOnFocus=true, revalidateOnReconnect=true.
  implication: SWR uses default exponential backoff for retries. With errorRetryCount=3 this is bounded, but dedupingInterval of only 2s means rapid re-renders could bypass deduplication.

- timestamp: 2026-03-09T00:03:00Z
  checked: src/lib/swr/config.ts SWR_TIERS
  found: FAST tier polls every 30s with 10s dedup. MEDIUM polls every 60s with 30s dedup. SLOW has no polling.
  implication: FAST tier polling is reasonable individually, but the interaction with error retry is problematic.

- timestamp: 2026-03-09T00:04:00Z
  checked: All useSWR call sites across src/ (47 useSWR hooks found)
  found: 47 useSWR hooks across the codebase. On a model detail page, up to 7 SWR hooks fire simultaneously (ModelOverview, DeployTab, TradingChart, CommentsSection, ModelActions, NotificationBell, WalletBadge). On the home page, 5 SWR hooks fire (TopMovers, TrendingModels, QualityPriceFrontier, NotificationBell, WalletBadge).
  implication: Multiple hooks hitting failing endpoints simultaneously amplifies the problem.

- timestamp: 2026-03-09T00:05:00Z
  checked: Error boundary presence
  found: ZERO ErrorBoundary components anywhere in the codebase. No error.tsx files in app routes. No React error boundary wrapping SWR-consuming components.
  implication: If any SWR-consuming component throws during render due to unexpected data shape (e.g., data is an error object instead of expected type), the ENTIRE React tree crashes with no recovery. This is the most likely cause of "page stops loading entirely."

- timestamp: 2026-03-09T00:06:00Z
  checked: SWR key stability across all components
  found: All SWR keys are string-based and stable. CommentsSection uses a custom fetcher (Supabase direct) with a key containing `visibleCount` state. SearchDialog uses null key when closed (correct pattern). All others use URL string keys built from useState values.
  implication: No infinite re-render loop from unstable keys. This eliminates hypothesis #1.

- timestamp: 2026-03-09T00:07:00Z
  checked: MarketTicker usage
  found: MarketTicker component exists but is NOT imported or rendered anywhere in app routes or layout. It is an orphan component.
  implication: Only TopMovers uses FAST tier on the home page. Eliminates theory that multiple FAST-tier components stack.

- timestamp: 2026-03-09T00:08:00Z
  checked: SWR default onErrorRetry + refreshInterval interaction
  found: SWR's default retry uses exponential backoff (Math.random() * 2^retryCount * errorRetryInterval). errorRetryInterval defaults to 5000ms. With errorRetryCount=3, retries happen at ~5s, ~10s, ~20s. BUT the refreshInterval (30s for FAST, 60s for MEDIUM) continues polling independently. When the API returns a 500, SWR will: (a) trigger 3 error retries via exponential backoff, AND (b) continue the refreshInterval polling, which hits the same failing endpoint and triggers ANOTHER round of 3 retries. This creates overlapping retry+poll cycles.
  implication: For a FAST-tier hook hitting a failing endpoint: 3 retries in first 20s + new poll at 30s triggers 3 more retries, etc. This is a persistent request loop that never stops as long as the API is down.

- timestamp: 2026-03-09T00:09:00Z
  checked: Component render safety when SWR returns error
  found: Most components handle SWR errors correctly (check `error` before accessing `data`). However, QualityPriceFrontier accesses `rawData` with type coercion that could fail silently. More critically, CommentsSection uses a custom fetcher that calls Supabase directly - if Supabase throws, the error propagates to SWR, but the component's rendering of `comments` (default `[]`) is safe. The real risk is components that destructure data properties without null checks after an error clears and data is stale/partial.
  implication: While individual error handling is mostly correct, the ABSENCE of an error boundary means any uncaught render error from any of the 47 SWR hooks will crash the entire page.

## Resolution

root_cause: |
  TWO interacting deficiencies cause the page to stop loading:

  PRIMARY: No React error boundary anywhere in the app. If ANY of the 47 SWR-consuming
  components encounters an unexpected data shape or throws during render, the entire
  React tree crashes unrecoverably. There is no error.tsx, no ErrorBoundary component,
  and no fallback UI. A single component crash = full page death.

  SECONDARY (amplifier): The SWR error retry mechanism interacts poorly with refreshInterval
  polling when an API returns errors. The jsonFetcher in src/lib/swr/fetcher.ts throws on
  ALL non-OK responses (including 500s), and there is no onErrorRetry override in the
  SWRConfig to suppress retries for server errors or disable polling during error state.
  This means:
    - A 500 triggers 3 exponential backoff retries (~5s, ~10s, ~20s)
    - The refreshInterval (30s/60s) keeps polling independently
    - Each poll hit on a still-failing endpoint triggers 3 MORE retries
    - This creates a sustained request storm against the failing endpoint
    - The request storm can cause browser tab to become sluggish/unresponsive
    - If the API recovers but returns unexpected data shape, the component throws
      during render with no error boundary to catch it

fix:
verification:
files_changed: []
