---
status: diagnosed
trigger: "SWR focus revalidation doesn't fire when switching back to the tab"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: SWR focus revalidation mechanism is correctly configured but the user may not observe visible changes due to dedupingInterval (2s global) or focusThrottleInterval (5s default) suppressing rapid re-fetches, OR the FAST/MEDIUM tier refreshInterval polling keeps data fresh so focus revalidation fetches return identical data (no visual change).
test: Code audit of SWR config, all useSWR callsites, SWR internals
expecting: Either a config override disabling revalidateOnFocus, or a structural reason focus revalidation appears not to fire
next_action: Return diagnosis

## Symptoms

expected: When user switches away from the tab and returns, SWR should re-fetch data from API endpoints
actual: User reports "no it does not fire up" when switching back to the tab
errors: None reported
reproduction: Switch to another tab, switch back, observe no network request / no data update
started: Unknown

## Eliminated

- hypothesis: revalidateOnFocus is set to false in SWRConfig
  evidence: providers.tsx line 60 explicitly sets revalidateOnFocus: true
  timestamp: 2026-03-09

- hypothesis: SWR_TIERS override revalidateOnFocus to false
  evidence: SWR_TIERS only set refreshInterval and dedupingInterval, no revalidateOnFocus key
  timestamp: 2026-03-09

- hypothesis: Individual useSWR hooks override revalidateOnFocus to false
  evidence: Grep for "revalidateOnFocus" across entire src/ returns only 1 hit (the SWRConfig in providers.tsx). No hook overrides it.
  timestamp: 2026-03-09

- hypothesis: SWRConfig provider is not wrapping the app
  evidence: layout.tsx line 87-106 shows SWRProvider wraps the entire body content
  timestamp: 2026-03-09

- hypothesis: Custom visibilitychange listeners interfere with SWR
  evidence: Grep for visibilitychange/visibilityState/document.hidden in src/ returns zero hits
  timestamp: 2026-03-09

- hypothesis: Service worker intercepts/caches API responses preventing fresh data
  evidence: sw.js line 36 explicitly skips /api/ routes: `if (url.pathname.startsWith("/api/")) return;`
  timestamp: 2026-03-09

## Evidence

- timestamp: 2026-03-09
  checked: providers.tsx SWRConfig
  found: revalidateOnFocus: true is explicitly set at line 60
  implication: Global config is correct

- timestamp: 2026-03-09
  checked: SWR_TIERS config (src/lib/swr/config.ts)
  found: Only defines refreshInterval and dedupingInterval for FAST/MEDIUM/SLOW tiers. No revalidateOnFocus override.
  implication: Tiers do not suppress focus revalidation

- timestamp: 2026-03-09
  checked: All 44 files with useSWR calls
  found: Hooks use `{ ...SWR_TIERS.FAST }` or `{ ...SWR_TIERS.MEDIUM }` spread syntax. No hook passes revalidateOnFocus: false.
  implication: No per-hook suppression

- timestamp: 2026-03-09
  checked: SWR 2.4.1 internals - initFocus mechanism
  found: initFocus registers both `document.addEventListener('visibilitychange', callback)` and `window.addEventListener('focus', callback)`. The callback is `setTimeout(revalidateAllKeys(EVENT_REVALIDATORS, FOCUS_EVENT))`.
  implication: SWR correctly listens for both visibility and focus events

- timestamp: 2026-03-09
  checked: SWR 2.4.1 internals - focus event handler in useSWR
  found: Focus revalidation is gated by THREE conditions: (1) getConfig().revalidateOnFocus must be true, (2) Date.now() > nextFocusRevalidatedAt (throttle), (3) isActive() must be true. isActive = isVisible() && isOnline().
  implication: focusThrottleInterval (5000ms default) prevents rapid re-fetches

- timestamp: 2026-03-09
  checked: SWR 2.4.1 internals - initCache and SWRConfig provider chain
  found: When SWRConfig has NO `provider` prop (our case), focus/reconnect listeners are registered on the DEFAULT cache created at module load time (`initCache(new Map())`), not via SWRConfig's useEffect. The SWRConfig only merges config values via context — it does NOT re-register event listeners. The default cache's initFocus runs once at module load.
  implication: Focus listeners ARE active from module load. The SWRConfig context correctly propagates revalidateOnFocus=true to all hooks via getConfig().

- timestamp: 2026-03-09
  checked: SWR 2.4.1 internals - deduplication
  found: softRevalidate uses WITH_DEDUPE flag. Combined with dedupingInterval (2000ms global, 10000ms FAST, 30000ms MEDIUM), if a polling refreshInterval already fetched data within the deduping window, the focus revalidation fetch will be deduped (silently skipped).
  implication: FAST tier (30s refresh, 10s dedup) and MEDIUM tier (60s refresh, 30s dedup) will often have recent fetches within their dedup windows, causing focus revalidation to be silently deduped.

- timestamp: 2026-03-09
  checked: sw.js service worker
  found: Line 36 explicitly skips /api/ and /auth/ routes
  implication: Service worker does not interfere with SWR API fetches

## Resolution

root_cause: |
  The SWR configuration is CORRECTLY set up. revalidateOnFocus: true IS properly configured and propagated. The issue is that focus revalidation FIRES but appears not to work due to TWO masking effects:

  1. **Deduplication suppression (PRIMARY):** The SWR_TIERS use large dedupingInterval values:
     - FAST tier: dedupingInterval = 10,000ms (10s)
     - MEDIUM tier: dedupingInterval = 30,000ms (30s)
     - SLOW tier: dedupingInterval = 300,000ms (5min)

     These tiers also have refreshInterval polling (FAST=30s, MEDIUM=60s). When the user switches back to the tab, SWR fires the focus revalidation, but `softRevalidate` uses `WITH_DEDUPE`. If any fetch for the same key occurred within the dedupingInterval, the focus revalidation is silently deduped — no network request fires.

     For FAST tier hooks (market ticker, top movers, trading chart): polling fetches every 30s, with 10s dedup window. There's a ~33% chance (10/30) the focus revalidation lands within the dedup window and gets silently dropped.

     For MEDIUM tier hooks (wallet, orders, notifications): polling fetches every 60s, with 30s dedup window. There's a ~50% chance (30/60) the focus revalidation is deduped.

     For SLOW tier hooks (model metadata): dedupingInterval of 300s (5 minutes) means ANY fetch in the last 5 minutes suppresses focus revalidation. Since these hooks fetch on mount, focus revalidation will almost ALWAYS be deduped for SLOW tier.

  2. **Focus throttle (SECONDARY):** SWR's default focusThrottleInterval is 5000ms. Rapid tab switches within 5s are throttled. This is normal and expected behavior.

  3. **No visible change even when fetch succeeds:** For data that hasn't changed server-side, SWR's `compare` (dequal) detects identical data and does not trigger a re-render. The user sees no visual update even though the network request fired.

fix: N/A (read-only investigation)
verification: N/A
files_changed: []
