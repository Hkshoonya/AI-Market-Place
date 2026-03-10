---
status: diagnosed
trigger: "Investigate why bookmark/save button doesn't work on model pages. User reported: can't bookmark but share works."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: handleBookmark for logged-in users does not optimistically update local state, and mutateBookmark() revalidates SWR but the useEffect that syncs dbBookmarked->isBookmarked may not fire immediately, causing the button to appear unresponsive. Additionally, Supabase insert/delete errors are silently swallowed (no try/catch), so RLS failures or network errors produce zero user feedback.
test: trace handleBookmark flow for logged-in user with modelId
expecting: button click fires Supabase call, but UI does not update until SWR revalidation completes (which could fail silently)
next_action: document root cause

## Symptoms

expected: Clicking bookmark button toggles bookmark state (heart fills, toast appears)
actual: Bookmark button does not work (per user report "can't bookmark but share works")
errors: Unknown - errors are swallowed (no try/catch in handleBookmark for DB path)
reproduction: Click bookmark button on any model detail page while logged in
started: After Phase 14 SWR migration

## Eliminated

- hypothesis: modelId not passed to ModelActions
  evidence: model-header.tsx line 85 passes `id={id}` from props, page.tsx line 196 passes `id={model.id}`. Confirmed present.
  timestamp: 2026-03-09

- hypothesis: onClick not wired to handleBookmark
  evidence: Line 124 `onClick={handleBookmark}` is correctly set on the Button component.
  timestamp: 2026-03-09

- hypothesis: SWR key prevents bookmark check for logged-in users
  evidence: Key `user && modelId ? ... : null` is correct pattern. Both user and modelId are available.
  timestamp: 2026-03-09

- hypothesis: Wrong table or column names in Supabase calls
  evidence: Table `user_bookmarks` with columns `user_id`, `model_id` matches database.ts types and API route usage.
  timestamp: 2026-03-09

## Evidence

- timestamp: 2026-03-09
  checked: model-actions.tsx handleBookmark function (lines 85-113)
  found: For logged-in users (user && modelId), the function does NOT set isBookmarked optimistically. It calls Supabase insert/delete, sets toast, then calls `await mutateBookmark()`. The only way isBookmarked updates is via the useEffect on line 68 which watches `dbBookmarked`. mutateBookmark() triggers SWR revalidation which re-fetches from DB, but the result flows through useEffect, not direct state set.
  implication: If the Supabase write fails silently (no try/catch), the toast still shows success ("bookmarked"), but mutateBookmark() re-fetches and gets the old value, so useEffect resets isBookmarked back. User sees toast but button reverts. If Supabase write succeeds, there's still a perceptible delay between click and UI update while SWR refetches.

- timestamp: 2026-03-09
  checked: Error handling in handleBookmark DB path
  found: Lines 89-101 have zero error handling. Supabase client calls `.delete()` and `.insert()` without checking the returned `{ error }`. No try/catch around the async operations. If RLS policy blocks the operation, the error is completely invisible.
  implication: This is the most likely root cause. If RLS policies on user_bookmarks don't allow client-side inserts (the API route at /api/bookmarks uses server-side createClient which has different auth), the insert fails silently. The toast says "bookmarked" but nothing was saved. mutateBookmark() refetches and finds no bookmark, resetting the UI.

- timestamp: 2026-03-09
  checked: API route vs direct Supabase client usage
  found: The API route at /api/bookmarks/route.ts uses server-side `createClient` from `@/lib/supabase/server` (line 3) with proper auth via cookies. The model-actions.tsx component uses browser-side `createClient` from `@/lib/supabase/client` (line 10). The API route uses `upsert` with `onConflict` (more robust). The component uses raw `insert` (no conflict handling, no error check).
  implication: The SWR conversion bypassed the API route entirely and calls Supabase directly from the browser. If RLS policies require server-side auth or if the anon key doesn't have insert permissions on user_bookmarks, every bookmark attempt fails silently.

- timestamp: 2026-03-09
  checked: Comparison of localStorage path vs DB path in handleBookmark
  found: The localStorage fallback path (lines 104-111) works correctly: calls toggleLocalBookmark which returns the new state, then immediately calls setIsBookmarked(nowBookmarked). This provides instant UI feedback. The DB path does NOT call setIsBookmarked at all -- it relies entirely on the SWR revalidation -> useEffect chain.
  implication: Even if the DB write succeeds, the UI update is delayed and indirect. The localStorage path (non-logged-in users) works perfectly, which matches "share works but bookmark doesn't" if the user is logged in.

## Resolution

root_cause: |
  TWO compounding bugs in the SWR conversion of model-actions.tsx:

  **Bug 1 (Critical): No optimistic UI update for logged-in users.**
  The handleBookmark function for the DB path (lines 86-102) never calls `setIsBookmarked()`.
  It relies on: Supabase write -> mutateBookmark() -> SWR refetch -> dbBookmarked updates -> useEffect sets isBookmarked.
  Compare with the localStorage path (lines 103-112) which immediately calls `setIsBookmarked(nowBookmarked)`.
  This means the button appears unresponsive even when the write succeeds.

  **Bug 2 (Critical): Silent error swallowing on Supabase calls.**
  Lines 89-101 do not check the `{ error }` return from Supabase `.delete()` or `.insert()`.
  No try/catch wraps these calls. If RLS policies block the browser-side write (likely, since the
  original API route used server-side auth), the operation fails with zero user feedback.
  The toast STILL shows "bookmarked" (line 100) even when insert fails, because the toast
  is set unconditionally before `await mutateBookmark()`.

  **Bug 3 (Architectural): Direct Supabase client calls bypass the API route.**
  The pre-SWR code likely used the `/api/bookmarks` API route (which uses server-side auth,
  upsert with conflict handling, and proper error responses). The SWR conversion replaced this
  with direct browser-side Supabase calls using the anon key. If the user_bookmarks table has
  RLS policies that only allow authenticated server-side operations, all browser-side writes fail.

  Net effect for logged-in users: Click bookmark -> Supabase insert silently fails (RLS) ->
  toast says "bookmarked" -> mutateBookmark() refetches -> finds no bookmark -> useEffect
  sets isBookmarked back to false -> button reverts. User sees momentary toast but bookmark
  doesn't stick.

  For non-logged-in users: localStorage path works fine (but they can't persist bookmarks
  across devices).

fix: (not applied - read-only investigation)
verification: (not applied - read-only investigation)
files_changed: []
