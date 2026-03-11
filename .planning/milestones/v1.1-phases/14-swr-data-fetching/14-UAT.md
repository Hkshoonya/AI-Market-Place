---
status: complete
phase: 14-swr-data-fetching
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md, 14-04-SUMMARY.md, 14-05-SUMMARY.md, 14-06-SUMMARY.md]
started: 2026-03-09T07:00:00Z
updated: 2026-03-09T08:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cached Data on Back-Navigation
expected: Navigate to a model detail page, wait for load, navigate away, press Back. The model page reappears instantly with cached data — no loading spinner or skeleton flash.
result: pass

### 2. Market Ticker Auto-Polling (FAST Tier)
expected: Open the site and observe the market ticker at the top. Open browser DevTools Network tab, filter by "ticker". After ~30 seconds, a new fetch request should fire automatically without any user interaction. This confirms FAST tier polling.
result: skipped
reason: Market ticker intentionally disabled by user. FAST tier config correctly wired for re-enablement.

### 3. Search Dialog Keeps Previous Results
expected: Open the search dialog (Ctrl+K or click search). Type a query like "gpt" and wait for results. Then change the query to "gpt-4". While the new results load, the previous "gpt" results should remain visible (no flash of empty state). New results replace them when ready.
result: pass

### 4. Chart Filter Auto-Refetch
expected: Navigate to a chart page (e.g., quality-price frontier or benchmark heatmap). Change a filter or dropdown option. The chart data should automatically refetch and update without needing to click a refresh button or reload the page.
result: issue
reported: "its fetching but embedding and audio gives fetch error 500, search error, decription error, image error, icon and other"
severity: major
fix: "Fixed in 0b48c60 — canonical category slugs + empty array guard"

### 5. Bookmark Toggle Revalidation
expected: Log in and navigate to a model page. Click the bookmark/save button. The bookmark state should toggle immediately. Navigate away and back — the bookmark state should persist (SWR cache updated via mutate()).
result: issue
reported: "can't bookmark but share works"
severity: major

### 6. Watchlist Create/Delete Revalidation
expected: Log in and go to /watchlists. Create a new watchlist. It should appear in the list immediately without page refresh. Delete a watchlist — it should disappear from the list immediately without page refresh.
result: issue
reported: "watchlist can be created but no delete option and view the list of watchlist option"
severity: major

### 7. Comment Submit Revalidation
expected: Navigate to a model with comments. Submit a new comment. The comment should appear in the list immediately after submission without needing to refresh the page (SWR mutate() triggers revalidation).
result: issue
reported: "not able to post or comment but was able to type"
severity: major

### 8. Focus Revalidation
expected: Open any data page (e.g., admin dashboard or model page). Switch to another browser tab or application for a few seconds. Switch back to the AI Market Cap tab. In DevTools Network tab, you should see a background fetch fire when the tab regains focus, silently refreshing the data.
result: issue
reported: "no it does not fire up"
severity: minor

### 9. Auth-Gated Fetching (Logged Out)
expected: Log out and visit a page that has auth-gated data (e.g., /watchlists or /settings). The page should render without console errors or failed API calls. Protected data sections show appropriate empty/login state rather than 401 errors in the console.
result: pass

### 10. Admin Page Pagination with SWR
expected: Log in as admin and go to /admin/listings or /admin/users. Use pagination controls and search/filter inputs. Each change should trigger a fresh data fetch (visible in DevTools Network tab) and update the table. Previously loaded pages should load faster from cache when revisited.
result: pass

### 11. Notification Bell Polling
expected: Log in and observe the notification bell in the header. In DevTools Network tab, filter by "notification". After ~60 seconds, a polling request should fire automatically (MEDIUM tier). No manual setInterval visible in component code.
result: pass

## Summary

total: 11
passed: 5
issues: 5
pending: 0
skipped: 1

## Gaps

- truth: "Chart filter auto-refetch works without errors across all categories"
  status: fixed
  reason: "User reported: its fetching but embedding and audio gives fetch error 500, search error, decription error, image error, icon and other"
  severity: major
  test: 4
  root_cause: "Hardcoded category slugs in chart-controls.tsx didn't match DB + missing empty-array guard in quality-price API route"
  artifacts:
    - path: "src/components/charts/chart-controls.tsx"
      issue: "Wrong category slugs (embedding vs embeddings, audio vs speech_audio)"
    - path: "src/app/api/charts/quality-price/route.ts"
      issue: "Missing empty-array guard before .in() call"
  missing: []
  debug_session: ".planning/debug/chart-filter-500-errors.md"

- truth: "Bookmark toggle works and persists via SWR cache"
  status: failed
  reason: "User reported: can't bookmark but share works"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Watchlist has delete option and list view"
  status: failed
  reason: "User reported: watchlist can be created but no delete option and view the list of watchlist option"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Comment can be submitted and appears immediately"
  status: failed
  reason: "User reported: not able to post or comment but was able to type"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Focus revalidation fires background fetch on tab re-focus"
  status: failed
  reason: "User reported: no it does not fire up"
  severity: minor
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
