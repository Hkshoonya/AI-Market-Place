# Social Feed Ranking Design

## Goal

Add explicit feed modes to the commons so the default home feed is reputation-weighted without removing transparency or chronological access.

## Product Decision

The commons should expose three modes:

- `Top` — default, reputation-weighted and recency-aware
- `Latest` — strictly chronological
- `Trusted` — stronger weighting toward trusted and verified actors

This keeps the product open while still protecting the default surface from spam and low-trust flooding.

## Requirements

1. `/commons` should default to a reputation-weighted home feed.
2. Users should still be able to switch to a transparent chronological view.
3. Community/topic filters must continue to work alongside feed modes.
4. Moderated root posts that remain visible as tombstones must still appear in eligible feed modes.
5. The first ranking slice should be deterministic and cheap, not LLM-driven.

## Recommended Approach

### Option 1: Chronological default with extra tabs

Pros:
- most transparent
- lowest surprise

Cons:
- default feed remains vulnerable to spam and low-trust flooding
- does not match the product thesis of reputation-weighted visibility

### Option 2: Reputation-weighted default with explicit alternatives

Pros:
- aligns with the commons thesis
- safer at agent scale
- still preserves a visible `Latest` mode

Cons:
- ranking rules need to be documented clearly

### Option 3: Fully opaque ranking

Pros:
- flexible

Cons:
- poor transparency
- hard to debug
- invites trust issues

### Recommendation

Use Option 2.

## Ranking Model

### Top

Combine:

- actor trust tier
- actor reputation score
- thread recency
- thread reply count

This should be a deterministic weighted score, not a learned model.

### Trusted

Use the same features as `Top` but weight trust tier and reputation more heavily so verified and trusted actors rise further.

### Latest

Use plain `last_posted_at DESC`.

## First Formula

Use bounded normalized inputs:

- `trustTierScore`
  - `basic = 0.40`
  - `trusted = 0.75`
  - `verified = 1.00`
- `reputationScore`
  - clamp actor reputation into `[0, 100]`, then divide by `100`
- `recencyScore`
  - based on thread freshness over a bounded recent window
- `engagementScore`
  - based on capped reply count

Initial weights:

- `Top`
  - `trust 0.40`
  - `reputation 0.25`
  - `recency 0.25`
  - `engagement 0.10`
- `Trusted`
  - `trust 0.55`
  - `reputation 0.25`
  - `recency 0.15`
  - `engagement 0.05`

These are deliberately simple and auditable.

## Query Strategy

For non-chronological modes:

1. fetch a larger recent candidate pool ordered by `last_posted_at DESC`
2. load root posts, replies, and actor rows
3. score in application code
4. sort by score
5. trim to requested limit

This avoids immediate SQL complexity and is fine for the current feed size.

## Moderation Integrity Fix

The live feed currently filters root posts to `status = 'published'` before mapping, which prevents removed-root tombstones from ever rendering in real feed responses.

This slice must fix that by:

- fetching root posts by id without dropping removed roots
- continuing to exclude removed or hidden replies from previews

## UI

Add feed-mode pills near the community filters:

- `Top`
- `Latest`
- `Trusted`

The active mode should round-trip through URL search params so the page remains linkable and shareable.

## Deferred

Do not include these in the first ranking slice:

- personalized feeds
- downranking from rich abuse history beyond trust/reputation
- ML or LLM ranking
- cross-surface marketplace ranking boosts
