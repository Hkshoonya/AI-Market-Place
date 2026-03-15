# Autonomous Commerce Guardrails and Illegal-Goods Policy Design

## Goal

Expand the marketplace trust rails so the platform can distinguish between:

- illegal or abusive content that nobody should buy
- legitimate but autonomy-unsafe listings that humans may still buy
- trusted manifest-backed listings that autonomous agents may purchase safely

The result should keep the marketplace open while making autonomous execution bounded and explainable.

## Problem

The current trust-rails slice established a useful baseline, but it is still too coarse in two places:

1. listing policy uses a single `allow/review/block` decision
2. autonomous purchase policy only answers a single question: can an API-key purchase proceed?

That creates a gap between content safety and autonomy safety.

Examples:

- a likely malware or credential-theft listing should be blocked for everyone
- a legitimate but manual or ambiguous integration should still be available to human buyers
- a trusted manifest-backed listing should be allowed for autonomous agents

The current model cannot express those differences cleanly.

## Decision

Split marketplace risk into two axes:

- `content_risk`
- `autonomy_risk`

Then drive three concrete outcomes from them:

- publishability
- purchaseability
- autonomy mode

## Approaches Considered

### Option 1: Keep the Current Single Decision

Continue using only `allow/review/block` everywhere.

Pros:
- minimal change

Cons:
- cannot separate illegal-content risk from autonomy-execution risk
- too blunt for human vs agent purchase behavior

### Option 2: Dual-Axis Risk Model

Separate content risk from autonomy risk and derive user-facing effects from both.

Pros:
- matches the actual marketplace problem
- keeps human/manual fallback possible where appropriate
- still allows strong hard blocks for illegal content

Cons:
- more policy surface and admin visibility needed

### Option 3: Fully Manual Approval Workflow

Require manual approval for most risky autonomous cases.

Pros:
- conservative

Cons:
- too slow
- too expensive
- incompatible with the product direction

### Recommendation

Use Option 2.

## Core Policy Model

### Content Risk

Content risk answers: is the good itself acceptable to sell here?

Values:

- `allow`
- `review`
- `block`

This covers:

- illegal goods
- malware
- credential theft
- exploit kits
- fraud tooling
- clearly unsafe abuse infrastructure

Rules:

- `block` means no purchases for anyone
- `review` means no purchases until cleared

### Autonomy Risk

Autonomy risk answers: even if this listing is legitimate, is it safe for autonomous execution?

Values:

- `allow`
- `manual_only`
- `restricted`
- `block`

This covers:

- missing or weak manifests
- manual fulfillment only
- seller trust too low
- price above trust tier
- sensitive listing types
- inadequate delivery guarantees for bot-to-bot use

Rules:

- humans may buy `manual_only` listings
- API-key agents may not

## Derived Marketplace Effects

The system should derive three operator-visible outcomes.

### Publishability

Whether the listing can be publicly active.

Values:

- `active`
- `draft`
- `paused`
- `blocked`

### Purchase Mode

Whether the listing can be purchased at all.

Values:

- `public_purchase_allowed`
- `manual_review_required`
- `purchase_blocked`

### Autonomy Mode

Whether autonomous agents may buy it.

Values:

- `autonomous_allowed`
- `manual_only`
- `restricted`
- `autonomous_blocked`

## Policy Rules

### Global Hard Blocks

These block everyone:

- stolen credentials
- phishing kits
- malware
- exploit kits
- credential abuse packages
- clearly prohibited abuse tooling

### Review Stops

These pause both humans and agents until review:

- ambiguous exploit language
- suspicious mass-abuse automation
- unclear manifest/tooling combinations that may be unsafe

### Human-Allowed, Agent-Blocked Cases

These allow human/manual fallback but stop autonomous execution:

- low-trust seller with otherwise legitimate listing
- manifest missing or too weak for agent-safe execution
- listing requires manual seller action
- high-price or high-sensitivity product outside agent policy tier

## Data Model

Prefer additive fields on the existing trust tables rather than inventing a parallel moderation system.

### listing_policy_reviews

Keep this table as the durable review ledger, but extend it with:

- `content_risk_level`
- `autonomy_risk_level`
- `purchase_mode`
- `autonomy_mode`
- `reason_codes`

### autonomous_commerce_policies

Extend buyer-side policies with:

- `require_manifest_snapshot`
- `allow_manual_only_listings`
- `max_trust_tier`
- `restricted_listing_types`

This keeps per-identity autonomy bounded and configurable.

## Enforcement Model

### Listing Create / Update

- evaluate content risk
- evaluate autonomy risk
- store the latest policy result
- keep current draft/paused fallback behavior

### Human Session Purchase

- blocked when content risk is `review` or `block`
- allowed when content risk is `allow` and purchase mode permits it
- may proceed on `manual_only`

### API-Key Purchase

- blocked when content risk is `review` or `block`
- blocked when autonomy mode is not agent-safe
- blocked when manifest-backed delivery is required but unavailable
- blocked when seller trust or spend policy is insufficient

## Operator Flow

Operators need enough information to understand why a listing is treated differently.

Admin listing responses should surface:

- `content_risk_level`
- `autonomy_risk_level`
- `purchase_mode`
- `autonomy_mode`
- `latest_policy_reason`
- `latest_policy_reason_codes`

This is enough to operate the system before a fuller dedicated dashboard exists.

## Compatibility Strategy

Keep compatibility with the existing `allow/review/block` language.

The richer policy object should still map back to the old decision so older code paths and views do not break during rollout.

## Testing Strategy

Required coverage:

- illegal goods hard block for all buyers
- review quarantine for all buyers
- manual-only listing allowed for session buyers
- manual-only listing blocked for API-key buyers
- manifest-required autonomous purchase blocked when snapshot path is not available
- admin listing API exposes the richer risk summary

## Success Criteria

The slice is successful when:

- illegal or abusive listings are blocked for everyone
- legitimate but autonomy-unsafe listings remain available to humans
- autonomous agents can only buy manifest-backed, policy-safe listings
- operators can see the reason for each listing’s purchase/autonomy mode
