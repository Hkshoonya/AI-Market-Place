---
status: diagnosed
trigger: "not able to post or comment but was able to type"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - submitComment silently swallows all Supabase insert errors with zero user feedback; if auth session is invalid (related to login-failing.md), RLS blocks the insert and the user sees no indication of failure
test: Full code trace of submit flow, RLS policies, error handling, SWR mutation path
expecting: Root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: User can type a comment and click Post to submit it; comment appears in the list
actual: User can type but submit does not work (no visible error, no comment posted)
errors: None visible to user (error silently swallowed)
reproduction: Log in, navigate to model detail page, type a comment, click Post
started: After Phase 14 SWR migration (plan 05 converted comments-section.tsx)

## Eliminated

- hypothesis: onClick handler not wired to the Post button
  evidence: Line 365 clearly has `onClick={() => submitComment(null)}` on the Button component. The Button component (src/components/ui/button.tsx) passes all props via `{...props}` to the underlying element.
  timestamp: 2026-03-09

- hypothesis: disabled prop permanently blocking clicks
  evidence: `disabled={submitting || !newComment.trim()}` — submitting defaults to false, and newComment reflects typed text via onChange. Both conditions are false when user has typed text and no submit is in progress. Button should be clickable.
  timestamp: 2026-03-09

- hypothesis: SWR conversion broke the submit function signature or removed the handler
  evidence: submitComment function exists at line 122, is async, takes parentId parameter with null default. Called correctly as `submitComment(null)` for top-level comments and `submitComment(comment.id)` for replies. Logic is intact.
  timestamp: 2026-03-09

- hypothesis: createClient() inside submitComment returns a different unauthenticated Supabase instance
  evidence: @supabase/ssr createBrowserClient uses a module-level singleton (cachedBrowserClient) in browser context. All calls to createClient() return the same authenticated instance. Verified in node_modules/@supabase/ssr/dist/module/createBrowserClient.js lines 5-11.
  timestamp: 2026-03-09

- hypothesis: Database Insert type mismatch (wrong fields sent)
  evidence: Insert type requires model_id (string), user_id (string), content (string), with optional parent_id. The insert call sends exactly {model_id: modelId, user_id: user.id, content: content.trim(), parent_id: parentId}. Perfect match.
  timestamp: 2026-03-09

- hypothesis: SWR mutate() throws and leaves submitting stuck as true
  evidence: SWR fetcher uses parseQueryResult which returns [] on any error (never throws). Supabase queries handle null with ?? operators. mutate() should resolve cleanly. Even if it threw, submitting would be stuck true only for ONE session — refreshing the page resets it.
  timestamp: 2026-03-09

- hypothesis: A wrapping form element causes page navigation on submit
  evidence: No <form> element wraps the comment textarea/button. The parent page (models/[slug]/page.tsx) renders CommentsSection directly in a div. No form anywhere in the component tree.
  timestamp: 2026-03-09

## Evidence

- timestamp: 2026-03-09
  checked: submitComment error handling (lines 130-148)
  found: |
    The insert result is captured as `const { error }` but when error is truthy, the function
    does NOTHING — no console.error, no toast, no error state, no UI feedback. It simply skips
    the success branch (clear text + mutate) and sets submitting back to false.
  implication: ANY insert failure (RLS, network, constraint) is completely invisible to the user. The user clicks Post, the button briefly shows as submitting, then returns to normal with the typed text preserved, and nothing happens.

- timestamp: 2026-03-09
  checked: RLS policy for comments insert (supabase/migrations/012_security_rls.sql lines 186-189)
  found: |
    INSERT policy: `WITH CHECK (auth.uid() = user_id)`.
    This requires the Supabase session's auth.uid() to match the user_id being inserted.
    If the session is expired/invalid, auth.uid() returns null and the check fails silently
    (Supabase returns { error: { message: "...", code: "42501" } }).
  implication: If auth session is invalid, insert fails with RLS violation but user sees nothing.

- timestamp: 2026-03-09
  checked: Login system status (cross-reference with login-failing.md)
  found: |
    login-failing.md (status: diagnosed) identified multiple potential login issues including
    OAuth redirect URL misconfiguration in Supabase dashboard. If login is broken, the user
    might have a stale session that appears valid in React state but is expired server-side.
  implication: The login issue and comments issue are likely linked — broken auth means broken RLS-gated mutations.

- timestamp: 2026-03-09
  checked: User conditional rendering (line 354)
  found: |
    The comment form (textarea + Post button) only renders when `user` is truthy:
    `{user ? (<div>...textarea...button...</div>) : (<div>Sign in prompt</div>)}`
    Since user can type, `user` IS truthy in React state.
  implication: The user appears authenticated to the frontend, but may not have a valid Supabase session token.

- timestamp: 2026-03-09
  checked: Auth provider session management (auth-provider.tsx)
  found: |
    Uses supabase.auth.getUser() on mount and onAuthStateChange listener. If session is
    truly expired, getUser() returns null and user state is set to null. BUT if the session
    token exists but is invalid (e.g., signed with wrong key, or Supabase project changed),
    getUser() might still return a user object while the session token fails RLS checks.
  implication: Edge case where user appears logged in but session is not valid for database operations.

- timestamp: 2026-03-09
  checked: SWR conversion changes to mutation flow
  found: |
    The SWR conversion (plan 05) replaced useEffect-based data fetching with useSWR, but the
    submitComment mutation function was kept intact per plan instructions ("Mutations: keep
    existing mutation logic, add mutate() call after success"). The only change was replacing
    the old manual refetch with `await mutate()` from SWR. The mutation logic itself was NOT
    altered.
  implication: The SWR conversion did not introduce a new bug in the submit flow. The silent error swallowing was a pre-existing deficiency that became apparent when combined with an auth issue.

## Resolution

root_cause: |
  TWO interacting issues prevent comment posting:

  PRIMARY: The `submitComment` function in comments-section.tsx (lines 130-148) silently
  swallows ALL Supabase insert errors. When the insert returns `{ error }`, the function
  skips the success branch but provides zero user feedback — no error message, no toast,
  no console output. The user sees the Post button briefly enter a submitting state, then
  return to normal with their typed text preserved, giving the appearance that "nothing happened."

  SECONDARY (likely trigger): The Supabase auth session is likely invalid for database
  operations. The login-failing.md debug session (status: diagnosed) identified that login
  itself has issues (OAuth redirect URL misconfiguration, potential PKCE flow failures).
  If the user's session token is expired or invalid, the RLS INSERT policy on the comments
  table (`auth.uid() = user_id`) fails, producing a Supabase error that gets silently
  swallowed by the primary issue.

  The SWR migration (Phase 14, Plan 05) did NOT introduce this bug. The mutation logic was
  preserved as-is per the plan. The silent error swallowing was a pre-existing code deficiency
  that became noticeable when combined with an auth session issue.

fix: (not applied -- read-only investigation)
verification: (not applied -- read-only investigation)
files_changed: []
