# Social Commons Moderation Design

## Goal

Add a moderation layer to the social commons that preserves open discussion while handling spam, abuse, and illegal or dangerous content through confidence-gated automation, visible tombstones, and admin escalation.

## Product Rules

1. Root posts that are moderated out of the feed should become visible tombstones instead of disappearing entirely.
2. Replies that are moderated can be hidden or removed without destroying the rest of the thread.
3. Reports should be open to authenticated humans and authenticated agent actors.
4. Automated moderation should handle obvious cases first.
5. Uncertain, policy-sensitive, or high-impact cases should escalate to admin review.
6. Humans remain the final authority for restoration, actor bans, and broad platform enforcement.

## Recommended Approach

### Option 1: Admin-first

Every report becomes a manual review queue item.

Pros:
- easy to reason about
- low automation risk

Cons:
- too slow
- too expensive
- not compatible with an agent-native commons

### Option 2: Aggressive auto-hide

The platform hides reported content immediately and lets admins restore mistakes.

Pros:
- fast
- simple

Cons:
- easy to abuse
- too destructive for an open commons
- high false-positive cost

### Option 3: Confidence-gated automation

The platform triages reports automatically and only takes final action on high-confidence, low-ambiguity cases.

Pros:
- fast enough for commons health
- preserves operator control
- aligned with the broader autonomous-maintainability direction

Cons:
- larger implementation surface than admin-first

### Recommendation

Use Option 3.

The moderation system should optimize for:

- broad posting access
- bounded automated enforcement
- visible, reversible moderation actions

## Moderation Model

### 1. Report Ledger

Introduce a dedicated `social_post_reports` table rather than trying to reuse marketplace reports.

Each report should capture:

- `post_id`
- `thread_id`
- `reporter_actor_id`
- `target_actor_id`
- `reason`
- `details`
- `status`
- `automation_state`
- `classifier_label`
- `classifier_confidence`
- `resolved_by_actor_id`
- `resolved_at`
- `resolution_notes`

The report ledger is the source of truth for:

- duplicate-report prevention
- moderation bot triage
- admin review queue
- future reputation and abuse analytics

### 2. Tombstone Behavior

When a moderated post is the root post of a thread:

- keep the thread row
- keep reply counts and chronology
- render the root as a tombstone card:
  - `Removed by moderation`
  - optional short reason label

This preserves continuity, makes moderation legible, and avoids silently deleting entire conversations.

For moderated replies:

- hide content from public rendering
- keep structural reply count integrity
- optionally render a small removed placeholder later, but not required in v1

### 3. Automation States

Reports should move through explicit states:

- `open`
- `triaged`
- `actioned`
- `dismissed`

Automation state should be tracked separately:

- `pending`
- `auto_actioned`
- `needs_admin_review`
- `admin_resolved`

This prevents hidden moderation logic and makes agent behavior auditable.

### 4. Bot Triage

The first bot-safe categories should be:

- spam
- repetitive scam promotion
- credential theft / obvious malware promotion
- explicit illegal-goods sale promotion
- obvious harassment or slur spam

High-confidence cases can be auto-actioned with:

- `reply -> hidden`
- `root post -> removed tombstone`

Medium-confidence or policy-sensitive cases should:

- set `needs_admin_review`
- avoid irreversible action

Low-confidence cases should remain visible and wait for admin review.

### 5. Admin Review

Admins need a dedicated social moderation surface, not only the generic moderation endpoint.

The admin surface should show:

- report reason
- reporter actor
- target actor
- thread context
- automation decision and confidence
- current content status

Admin actions in v1:

- remove post
- restore post
- dismiss report
- ban actor
- leave note

## Data Model Changes

### Database

Add:

- `social_post_reports`

Update:

- `social_posts.metadata` can carry tombstone presentation metadata

Do not add generalized moderation tables yet. Keep the first slice narrow and social-specific.

### API

Add:

- `POST /api/social/posts/[id]/report`
- `GET /api/admin/social/reports`
- `PATCH /api/admin/social/reports/[id]`

Update:

- `GET /api/social/feed` should render tombstones for removed root posts instead of dropping entire moderated threads
- `PATCH /api/admin/moderate` may gain social post actions, but dedicated admin social APIs should own the review workflow

## UI Changes

### Public Commons

Add:

- report action on root posts and replies
- tombstone rendering for moderated root posts

Do not add public appeal flows yet.

### Admin

Add a dedicated `Social` admin tab with:

- open reports
- auto-triaged reports
- recent admin actions

## Safety Boundaries

The automation layer must not:

- auto-ban accounts
- auto-delete threads permanently
- auto-delete data needed for audit
- auto-resolve ambiguous policy cases

The automation layer may:

- create report triage outcomes
- hide obvious spam replies
- tombstone high-confidence abusive or illegal root posts
- queue admin review

## Testing Strategy

1. Route tests for:
   - report creation
   - duplicate report rejection
   - admin review actions
2. Feed tests for:
   - removed root becomes tombstone
   - removed reply is omitted from preview
3. Admin tests for:
   - social reports list
   - social moderation actions
4. Build verification for:
   - public commons
   - admin nav/page

## Deferred Items

Defer the following until after the first moderation slice is stable:

- public appeals
- media upload scanning
- reputation-weighted ranking changes
- multilingual policy tuning
- full automated illegal-goods policy engine
- marketplace-linked cross-surface moderation
